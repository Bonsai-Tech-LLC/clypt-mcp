/**
 * Integration tests for clypt-mcp
 *
 * These tests validate the MCP server by spawning it as a child process
 * and communicating via the MCP JSON-RPC protocol over stdio.
 *
 * Requires CLYPT_API_KEY environment variable to be set.
 *
 * Usage:
 *   npx tsx tests/integration.test.ts
 */

import { spawn, ChildProcess } from "child_process";
import { resolve } from "path";

// ---------- helpers ----------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

let nextId = 1;
let serverProcess: ChildProcess;
let responseBuffer = "";
let pendingResolvers: Map<number, (resp: JsonRpcResponse) => void> = new Map();

function startServer(): Promise<void> {
  return new Promise((resolveStart, reject) => {
    serverProcess = spawn("node", [resolve(__dirname, "../dist/index.js")], {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    serverProcess.stderr!.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("running on stdio")) {
        resolveStart();
      }
    });

    serverProcess.stdout!.on("data", (data) => {
      responseBuffer += data.toString();
      processBuffer();
    });

    serverProcess.on("error", reject);
    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout if server doesn't start
    setTimeout(() => reject(new Error("Server start timeout")), 10000);
  });
}

function processBuffer() {
  // MCP uses Content-Length framed messages
  while (true) {
    const headerEnd = responseBuffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;

    const header = responseBuffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      responseBuffer = responseBuffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (responseBuffer.length < bodyStart + contentLength) break;

    const body = responseBuffer.slice(bodyStart, bodyStart + contentLength);
    responseBuffer = responseBuffer.slice(bodyStart + contentLength);

    try {
      const json = JSON.parse(body) as JsonRpcResponse;
      const resolver = pendingResolvers.get(json.id);
      if (resolver) {
        pendingResolvers.delete(json.id);
        resolver(json);
      }
    } catch {
      // ignore parse errors
    }
  }
}

function sendRequest(
  method: string,
  params?: Record<string, unknown>
): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined && { params }),
    };

    pendingResolvers.set(id, resolve);

    const body = JSON.stringify(request);
    const message = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;

    serverProcess.stdin!.write(message, (err) => {
      if (err) reject(err);
    });

    // Timeout
    setTimeout(() => {
      if (pendingResolvers.has(id)) {
        pendingResolvers.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }
    }, 15000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
}

// ---------- test runner ----------

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  â ${name}`);
  } catch (error: any) {
    failed++;
    failures.push(`${name}: ${error.message}`);
    console.log(`  â ${name}`);
    console.log(`    ${error.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertExists(value: unknown, message: string) {
  if (value === undefined || value === null)
    throw new Error(message);
}

// ---------- tests ----------

async function runTests() {
  console.log("\nð§ª Clypt MCP Integration Tests\n");

  if (!process.env.CLYPT_API_KEY) {
    console.error("â CLYPT_API_KEY is required. Set it and try again.");
    process.exit(1);
  }

  console.log("Starting MCP server...");
  await startServer();
  console.log("Server started.\n");

  // -- Initialize --
  console.log("Protocol:");
  await test("initialize handshake", async () => {
    const resp = await sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    assert(!resp.error, `Init error: ${resp.error?.message}`);
    const result = resp.result as any;
    assert(result.serverInfo.name === "clypt-mcp", "Wrong server name");
    assert(result.serverInfo.version === "1.1.0", "Wrong version");
    assert(result.capabilities.tools !== undefined, "Tools capability missing");
    assert(
      result.capabilities.resources !== undefined,
      "Resources capability missing"
    );
    assert(
      result.capabilities.prompts !== undefined,
      "Prompts capability missing"
    );
  });

  await test("initialized notification", async () => {
    // Send initialized notification (no response expected)
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    const message = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
    serverProcess.stdin!.write(message);
    // Small delay to let server process
    await new Promise((r) => setTimeout(r, 200));
  });

  // -- Tools --
  console.log("\nTools:");
  let allTools: any[] = [];

  await test("list all tools", async () => {
    const resp = await sendRequest("tools/list", {});
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    allTools = result.tools;
    assert(Array.isArray(allTools), "tools should be array");
    assert(allTools.length === 9, `Expected 9 tools, got ${allTools.length}`);
  });

  await test("tools have correct names", async () => {
    const names = allTools.map((t: any) => t.name).sort();
    const expected = [
      "bulk_shorten",
      "delete_link",
      "generate_qr_code",
      "get_dashboard_stats",
      "get_link_analytics",
      "list_links",
      "manage_folders",
      "manage_tags",
      "shorten_link",
    ];
    assert(
      JSON.stringify(names) === JSON.stringify(expected),
      `Tool names mismatch: ${JSON.stringify(names)}`
    );
  });

  await test("tools have descriptions and input schemas", async () => {
    for (const tool of allTools) {
      assertExists(tool.description, `Tool ${tool.name} missing description`);
      assertExists(
        tool.inputSchema,
        `Tool ${tool.name} missing inputSchema`
      );
    }
  });

  // -- Tool Execution: Dashboard Stats --
  await test("get_dashboard_stats returns stats", async () => {
    const resp = await sendRequest("tools/call", {
      name: "get_dashboard_stats",
      arguments: {},
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    assert(Array.isArray(result.content), "content should be array");
    const text = result.content[0].text;
    const data = JSON.parse(text);
    assert(
      typeof data.totalLinks === "number",
      "totalLinks should be a number"
    );
    assert(
      typeof data.totalClicks === "number",
      "totalClicks should be a number"
    );
  });

  // -- Tool Execution: List Links --
  await test("list_links returns links array", async () => {
    const resp = await sendRequest("tools/call", {
      name: "list_links",
      arguments: { limit: 5 },
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    const data = JSON.parse(result.content[0].text);
    assert(typeof data.total === "number", "total should be a number");
    assert(Array.isArray(data.links), "links should be an array");
  });

  // -- Tool Execution: Shorten + Delete (create then clean up) --
  let testLinkId: string | null = null;

  await test("shorten_link creates a link", async () => {
    const resp = await sendRequest("tools/call", {
      name: "shorten_link",
      arguments: { url: "https://example.com/integration-test" },
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    const data = JSON.parse(result.content[0].text);
    assertExists(data.shortUrl, "shortUrl missing");
    assertExists(data.id, "id missing");
    assertExists(data.shortCode, "shortCode missing");
    testLinkId = data.id;
  });

  await test("get_link_analytics for created link", async () => {
    if (!testLinkId) throw new Error("No test link created");
    const resp = await sendRequest("tools/call", {
      name: "get_link_analytics",
      arguments: { linkId: testLinkId, period: "7d" },
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    const data = JSON.parse(result.content[0].text);
    assert(
      typeof data.totalClicks === "number",
      "totalClicks should be a number"
    );
  });

  await test("generate_qr_code for a URL", async () => {
    const resp = await sendRequest("tools/call", {
      name: "generate_qr_code",
      arguments: { url: "https://clypt.io" },
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    const data = JSON.parse(result.content[0].text);
    assertExists(data.qrCodeUrl, "qrCodeUrl missing");
    assert(data.qrCodeUrl.includes("qrserver"), "Unexpected QR URL");
  });

  await test("manage_tags list", async () => {
    const resp = await sendRequest("tools/call", {
      name: "manage_tags",
      arguments: { action: "list" },
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    const data = JSON.parse(result.content[0].text);
    assert(Array.isArray(data.tags), "tags should be an array");
  });

  await test("manage_folders list", async () => {
    const resp = await sendRequest("tools/call", {
      name: "manage_folders",
      arguments: { action: "list" },
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    const data = JSON.parse(result.content[0].text);
    assert(Array.isArray(data.folders), "folders should be an array");
  });

  await test("delete_link removes the test link", async () => {
    if (!testLinkId) throw new Error("No test link to delete");
    const resp = await sendRequest("tools/call", {
      name: "delete_link",
      arguments: { linkId: testLinkId },
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    const data = JSON.parse(result.content[0].text);
    assert(data.deleted === true, "deleted should be true");
  });

  // -- Resources --
  console.log("\nResources:");
  let allResources: any[] = [];

  await test("list all resources", async () => {
    const resp = await sendRequest("resources/list", {});
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    allResources = result.resources;
    assert(Array.isArray(allResources), "resources should be array");
    assert(
      allResources.length === 5,
      `Expected 5 resources, got ${allResources.length}`
    );
  });

  await test("resources have correct URIs", async () => {
    const uris = allResources.map((r: any) => r.uri).sort();
    const expected = [
      "clypt://account/stats",
      "clypt://api/docs",
      "clypt://folders",
      "clypt://links/recent",
      "clypt://tags",
    ];
    assert(
      JSON.stringify(uris) === JSON.stringify(expected),
      `Resource URIs mismatch: ${JSON.stringify(uris)}`
    );
  });

  await test("read api-docs resource", async () => {
    const resp = await sendRequest("resources/read", {
      uri: "clypt://api/docs",
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    assert(
      result.contents[0].mimeType === "text/markdown",
      "Should be markdown"
    );
    assert(
      result.contents[0].text.includes("# Clypt API Documentation"),
      "Should contain API docs"
    );
  });

  await test("read account-stats resource", async () => {
    const resp = await sendRequest("resources/read", {
      uri: "clypt://account/stats",
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    const data = JSON.parse(result.contents[0].text);
    assert(typeof data.totalLinks === "number", "Should have totalLinks");
  });

  await test("read recent-links resource", async () => {
    const resp = await sendRequest("resources/read", {
      uri: "clypt://links/recent",
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    const data = JSON.parse(result.contents[0].text);
    assert(Array.isArray(data.links), "Should have links array");
  });

  // -- Prompts --
  console.log("\nPrompts:");
  let allPrompts: any[] = [];

  await test("list all prompts", async () => {
    const resp = await sendRequest("prompts/list", {});
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    allPrompts = result.prompts;
    assert(Array.isArray(allPrompts), "prompts should be array");
    assert(
      allPrompts.length === 5,
      `Expected 5 prompts, got ${allPrompts.length}`
    );
  });

  await test("prompts have correct names", async () => {
    const names = allPrompts.map((p: any) => p.name).sort();
    const expected = [
      "analytics-report",
      "bulk-import",
      "campaign-setup",
      "link-cleanup",
      "shorten-url",
    ];
    assert(
      JSON.stringify(names) === JSON.stringify(expected),
      `Prompt names mismatch: ${JSON.stringify(names)}`
    );
  });

  await test("get shorten-url prompt", async () => {
    const resp = await sendRequest("prompts/get", {
      name: "shorten-url",
      arguments: { url: "https://example.com" },
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    assert(Array.isArray(result.messages), "messages should be array");
    assert(result.messages.length > 0, "Should have at least one message");
    assert(
      result.messages[0].content.text.includes("https://example.com"),
      "Should include the URL"
    );
  });

  await test("get analytics-report prompt", async () => {
    const resp = await sendRequest("prompts/get", {
      name: "analytics-report",
      arguments: { period: "7d" },
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    assert(
      result.messages[0].content.text.includes("7d"),
      "Should include the period"
    );
  });

  await test("get link-cleanup prompt (no args)", async () => {
    const resp = await sendRequest("prompts/get", {
      name: "link-cleanup",
      arguments: {},
    });
    assert(!resp.error, `Error: ${resp.error?.message}`);
    const result = resp.result as any;
    assert(
      result.messages[0].content.text.includes("clean up"),
      "Should include cleanup instructions"
    );
  });

  // -- Summary --
  console.log(`\n${"â".repeat(40)}`);
  console.log(
    `\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`
  );
  if (failures.length > 0) {
    console.log("Failures:");
    failures.forEach((f) => console.log(`  â¢ ${f}`));
  }

  stopServer();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  stopServer();
  process.exit(1);
});
