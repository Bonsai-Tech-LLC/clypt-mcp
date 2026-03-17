#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { ClyptClient } from "./client.js";

// Tools
import { registerShortenLink } from "./tools/shorten-link.js";
import { registerListLinks } from "./tools/list-links.js";
import {
  registerGetLinkAnalytics,
  registerGetDashboardStats,
} from "./tools/analytics.js";
import { registerGenerateQrCode } from "./tools/qr-code.js";
import { registerManageTags } from "./tools/tags.js";
import { registerManageFolders } from "./tools/folders.js";
import { registerBulkShorten } from "./tools/bulk.js";
import { registerDeleteLink } from "./tools/delete.js";
import { registerAbTesting } from "./tools/ab-testing.js";
import { registerAiQrCode } from "./tools/ai-qr.js";

// Resources & Prompts
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

async function main() {
  const config = loadConfig();
  const client = new ClyptClient(config);

  const server = new McpServer({
    name: "clypt-mcp",
    version: "1.2.0",
  });

  // Register all tools
  registerShortenLink(server, client);
  registerListLinks(server, client);
  registerGetLinkAnalytics(server, client);
  registerGetDashboardStats(server, client);
  registerGenerateQrCode(server, client);
  registerManageTags(server, client);
  registerManageFolders(server, client);
  registerBulkShorten(server, client);
  registerDeleteLink(server, client);
  registerAbTesting(server, client);
  registerAiQrCode(server, client);

  // Register resources
  registerResources(server, client, config);

  // Register prompts
  registerPrompts(server);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error("Clypt MCP Server running on stdio");
  console.error(`Connected to: ${config.baseUrl}`);
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
