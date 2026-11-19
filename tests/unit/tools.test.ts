import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ClyptClient } from "../../src/client.js";
import { missingTags } from "../../src/link-tags.js";
import { registerGetLinkAnalytics } from "../../src/tools/analytics.js";
import { registerBulkShorten } from "../../src/tools/bulk.js";
import { registerManageFolders } from "../../src/tools/folders.js";
import {
  findTagByName,
  offsetToPage,
  registerListLinks,
  summarizeLink,
} from "../../src/tools/list-links.js";
import { registerShortenLink } from "../../src/tools/shorten-link.js";
import { registerManageTags } from "../../src/tools/tags.js";
import {
  apiLink,
  forbidden,
  jsonResponse,
  linkAnalytics,
  linkList,
} from "./fixtures.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

type Register = (server: McpServer, client: ClyptClient) => void;

let mcp: Client | undefined;

// Registers the tools on a real McpServer and connects an MCP client to it,
// so calls go through the tools' input schemas.
async function connect(register: Register) {
  const server = new McpServer({ name: "clypt-mcp-test", version: "0.0.0" });
  register(
    server,
    new ClyptClient({ apiKey: "clypt_testkey123", baseUrl: "https://clypt.io" })
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  mcp = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    mcp.connect(clientTransport),
  ]);
}

async function callTool(name: string, args: Record<string, unknown>) {
  const result = await mcp!.callTool({ name, arguments: args });
  const [content] = result.content as { type: string; text: string }[];
  return { isError: result.isError === true, text: content.text };
}

interface ApiRequest {
  method: string;
  url: URL;
  body: any;
}

// Answers each fetch with the handler's Response
function serve(handler: (req: ApiRequest) => Response) {
  mockFetch.mockImplementation(async (url: string, init: RequestInit) =>
    handler({
      method: init.method ?? "GET",
      url: new URL(url),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    })
  );
}

function requests(): ApiRequest[] {
  return mockFetch.mock.calls.map(([url, init]) => ({
    method: init.method,
    url: new URL(url),
    body: init.body ? JSON.parse(init.body) : undefined,
  }));
}

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(async () => {
  await mcp?.close();
  mcp = undefined;
});

describe("bulk_shorten", () => {
  it("counts every link the API created, reading the unwrapped link", async () => {
    await connect(registerBulkShorten);
    serve(({ body }) =>
      body.url === "https://example.com/b"
        ? jsonResponse({ error: "Failed to create link" }, 500)
        : jsonResponse(
            apiLink({
              id: `id_${body.url.slice(-1)}`,
              shortCode: `code_${body.url.slice(-1)}`,
              url: body.url,
            }),
            201
          )
    );

    const result = await callTool("bulk_shorten", {
      urls: [
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/c",
      ],
    });

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text)).toEqual({
      created: 2,
      failed: 1,
      links: [
        {
          originalUrl: "https://example.com/a",
          shortUrl: "https://clypt.io/code_a",
          shortCode: "code_a",
          id: "id_a",
        },
        {
          originalUrl: "https://example.com/c",
          shortUrl: "https://clypt.io/code_c",
          shortCode: "code_c",
          id: "id_c",
        },
      ],
      errors: [
        {
          originalUrl: "https://example.com/b",
          error: "Clypt API error (500): Failed to create link",
        },
      ],
    });
  });

  it("sends tag names and the folder with each link", async () => {
    await connect(registerBulkShorten);
    serve(() =>
      jsonResponse(
        apiLink({ tags: [{ id: "tag_1", name: "news", color: "#6366f1" }] }),
        201
      )
    );

    const result = await callTool("bulk_shorten", {
      urls: ["https://example.com/a", "https://example.com/b"],
      tags: ["news"],
      folderId: "fold_1",
    });

    expect(requests().map((req) => req.body)).toEqual([
      { url: "https://example.com/a", tags: ["news"], folderId: "fold_1" },
      { url: "https://example.com/b", tags: ["news"], folderId: "fold_1" },
    ]);
    const output = JSON.parse(result.text);
    expect(output.created).toBe(2);
    expect(output.warning).toBeUndefined();
  });

  it("warns when the server ignores the tag names", async () => {
    await connect(registerBulkShorten);
    // Servers that read only tagIds create the link without tags
    serve(() => jsonResponse(apiLink({ tags: [] }), 201));

    const result = await callTool("bulk_shorten", {
      urls: ["https://example.com/a"],
      tags: ["news"],
    });

    const output = JSON.parse(result.text);
    expect(output.created).toBe(1);
    expect(output.failed).toBe(0);
    expect(output.warning).toContain("Tags not applied: news.");
  });
});

describe("shorten_link", () => {
  it("sends the slug as customCode and slug and reports the API's url", async () => {
    await connect(registerShortenLink);
    serve(() =>
      jsonResponse(
        apiLink({
          id: "clnk_promo",
          shortCode: "promo",
          url: "https://example.com/landing",
        }),
        201
      )
    );

    const result = await callTool("shorten_link", {
      url: "https://example.com/landing",
      slug: "promo",
    });

    expect(requests()[0].body).toEqual({
      url: "https://example.com/landing",
      slug: "promo",
      customCode: "promo",
    });
    expect(JSON.parse(result.text)).toEqual({
      shortUrl: "https://clypt.io/promo",
      shortCode: "promo",
      originalUrl: "https://example.com/landing",
      id: "clnk_promo",
      createdAt: "2026-11-19T12:00:00.000Z",
    });
  });

  it("warns about tag names the server did not attach", async () => {
    await connect(registerShortenLink);
    serve(() =>
      jsonResponse(
        apiLink({ tags: [{ id: "tag_1", name: "news", color: "#6366f1" }] }),
        201
      )
    );

    const result = await callTool("shorten_link", {
      url: "https://example.com/",
      tags: ["news", "q4"],
    });

    const output = JSON.parse(result.text);
    expect(output.tags).toEqual([
      { id: "tag_1", name: "news", color: "#6366f1" },
    ]);
    expect(output.warning).toContain("Tags not applied: q4.");
  });
});

describe("manage_tags and manage_folders", () => {
  it("manage_tags create returns the tag the API created", async () => {
    await connect(registerManageTags);
    const tag = {
      id: "tag_1",
      name: "marketing",
      color: "#6366f1",
      userId: "user_1",
      createdAt: "2026-11-19T12:00:00.000Z",
    };
    serve(() => jsonResponse(tag, 201));

    const result = await callTool("manage_tags", {
      action: "create",
      name: "marketing",
    });

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text)).toEqual(tag);
  });

  it("manage_folders create returns the folder the API created", async () => {
    await connect(registerManageFolders);
    const folder = {
      id: "fold_1",
      name: "campaigns",
      parentId: null,
      linkCount: 0,
      subfolderCount: 0,
      createdAt: "2026-11-19T12:00:00.000Z",
    };
    serve(() => jsonResponse(folder, 201));

    const result = await callTool("manage_folders", {
      action: "create",
      name: "campaigns",
    });

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text)).toEqual(folder);
  });
});

describe("list_links", () => {
  const tag = (id: string, name: string) => ({
    id,
    name,
    color: "#6366f1",
    linkCount: 1,
    createdAt: "2026-11-19T12:00:00.000Z",
  });
  const tags = { tags: [tag("tag_news", "News"), tag("tag_q4", "q4")] };

  it("maps the API's links and pagination", async () => {
    await connect(registerListLinks);
    serve(() =>
      jsonResponse(
        linkList(
          [
            apiLink({
              url: "https://example.com/a",
              clickCount: 7,
              tags: [{ id: "tag_news", name: "News", color: "#6366f1" }],
            }),
          ],
          { total: 41 }
        )
      )
    );

    const result = await callTool("list_links", { search: "example" });

    const [req] = requests();
    expect(req.url.pathname).toBe("/api/v1/links");
    expect(Object.fromEntries(req.url.searchParams)).toEqual({
      search: "example",
      limit: "20",
    });
    expect(JSON.parse(result.text)).toEqual({
      total: 41,
      page: 1,
      pages: 3,
      count: 1,
      links: [
        {
          id: "clnk_1",
          shortUrl: "https://clypt.io/abc123",
          shortCode: "abc123",
          originalUrl: "https://example.com/a",
          clickCount: 7,
          createdAt: "2026-11-19T12:00:00.000Z",
          tags: [{ id: "tag_news", name: "News", color: "#6366f1" }],
        },
      ],
    });
  });

  it("sends page and limit, converting the old offset argument to a page", async () => {
    await connect(registerListLinks);
    serve(() => jsonResponse(linkList([], { page: 3, limit: 20, total: 41 })));

    await callTool("list_links", { limit: 20, offset: 40 });

    const params = Object.fromEntries(requests()[0].url.searchParams);
    expect(params).toEqual({ page: "3", limit: "20" });
  });

  it("prefers page over offset", async () => {
    await connect(registerListLinks);
    serve(() => jsonResponse(linkList([], { page: 2, limit: 10 })));

    await callTool("list_links", { limit: 10, page: 2, offset: 35 });

    const params = Object.fromEntries(requests()[0].url.searchParams);
    expect(params).toEqual({ page: "2", limit: "10" });
  });

  it("rejects an offset that is not a multiple of limit", async () => {
    await connect(registerListLinks);

    const result = await callTool("list_links", { limit: 20, offset: 30 });

    expect(result.isError).toBe(true);
    expect(result.text).toContain("not a multiple of limit 20");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("looks a tag name up and filters by its ID", async () => {
    await connect(registerListLinks);
    serve(({ url }) =>
      url.pathname === "/api/v1/tags"
        ? jsonResponse(tags)
        : jsonResponse(linkList([apiLink()]))
    );

    const result = await callTool("list_links", { tag: "news" });

    expect(result.isError).toBe(false);
    const [tagsReq, linksReq] = requests();
    expect(tagsReq.url.pathname).toBe("/api/v1/tags");
    expect(linksReq.url.searchParams.get("tagId")).toBe("tag_news");
    expect(linksReq.url.searchParams.has("tag")).toBe(false);
  });

  it("explains the tags:read scope when the tag lookup is forbidden", async () => {
    await connect(registerListLinks);
    serve(() => forbidden("tags:read"));

    const result = await callTool("list_links", { tag: "news" });

    expect(result.isError).toBe(true);
    expect(result.text).toContain('"tags:read" scope');
    expect(result.text).toContain("tagId");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("reports a tag name that does not exist", async () => {
    await connect(registerListLinks);
    serve(() => jsonResponse(tags));

    const result = await callTool("list_links", { tag: "nope" });

    expect(result.isError).toBe(true);
    expect(result.text).toContain('No tag named "nope"');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("filters by tagId without looking tags up", async () => {
    await connect(registerListLinks);
    serve(() => jsonResponse(linkList([])));

    await callTool("list_links", { tag: "news", tagId: "tag_q4" });

    const [req] = requests();
    expect(req.url.pathname).toBe("/api/v1/links");
    expect(req.url.searchParams.get("tagId")).toBe("tag_q4");
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

describe("get_link_analytics", () => {
  it("passes a supported period to the API", async () => {
    await connect(registerGetLinkAnalytics);
    serve(() => jsonResponse({ ...linkAnalytics, period: "24h" }));

    const result = await callTool("get_link_analytics", {
      linkId: "clnk_1",
      period: "24h",
    });

    expect(result.isError).toBe(false);
    const [req] = requests();
    expect(req.url.pathname).toBe("/api/v1/links/clnk_1/analytics");
    expect(req.url.searchParams.get("period")).toBe("24h");
    expect(JSON.parse(result.text).totalClicks).toBe(12);
  });

  it("rejects a period the API does not support", async () => {
    await connect(registerGetLinkAnalytics);

    const result = await callTool("get_link_analytics", {
      linkId: "clnk_1",
      period: "all",
    });

    expect(result.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("looks a short code up when the API does not know it as an ID", async () => {
    await connect(registerGetLinkAnalytics);
    serve(({ url }) => {
      if (url.pathname === "/api/v1/links/abc123/analytics") {
        return jsonResponse({ error: "Link not found" }, 404);
      }
      if (url.pathname === "/api/v1/links") {
        return jsonResponse(
          linkList([
            apiLink({ id: "clnk_other", shortCode: "abc1234" }),
            apiLink({ id: "clnk_abc", shortCode: "abc123" }),
          ])
        );
      }
      return jsonResponse({ ...linkAnalytics, linkId: "clnk_abc" });
    });

    const result = await callTool("get_link_analytics", {
      linkId: "abc123",
      period: "7d",
    });

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text).linkId).toBe("clnk_abc");
    expect(requests().map((req) => req.url.pathname + req.url.search)).toEqual([
      "/api/v1/links/abc123/analytics?period=7d",
      "/api/v1/links?search=abc123&limit=100&page=1",
      "/api/v1/links/clnk_abc/analytics?period=7d",
    ]);
  });

  it("reports a value that is neither a link ID nor a short code", async () => {
    await connect(registerGetLinkAnalytics);
    serve(({ url }) =>
      url.pathname === "/api/v1/links"
        ? jsonResponse(linkList([apiLink({ shortCode: "nope-2" })]))
        : jsonResponse({ error: "Link not found" }, 404)
    );

    const result = await callTool("get_link_analytics", { linkId: "nope" });

    expect(result.isError).toBe(true);
    expect(result.text).toContain('no link has the ID or short code "nope"');
  });

  it("names the analytics:read scope when the API key lacks it", async () => {
    await connect(registerGetLinkAnalytics);
    serve(() => forbidden("analytics:read"));

    const result = await callTool("get_link_analytics", { linkId: "clnk_1" });

    expect(result.isError).toBe(true);
    expect(result.text).toContain('"analytics:read" scope');
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

describe("helpers", () => {
  it("offsetToPage converts offsets on a page boundary", () => {
    expect(offsetToPage(0, 20)).toBe(1);
    expect(offsetToPage(40, 20)).toBe(3);
    expect(offsetToPage(30, 20)).toBeNull();
  });

  it("findTagByName prefers an exact match, then one case-insensitive match", () => {
    const tag = (id: string, name: string) => ({
      id,
      name,
      color: "#6366f1",
      createdAt: "2026-11-19T12:00:00.000Z",
    });
    const tags = [tag("a", "Promo"), tag("b", "promo"), tag("c", "News")];
    expect(findTagByName(tags, "promo")?.id).toBe("b");
    expect(findTagByName(tags, " news ")?.id).toBe("c");
    expect(findTagByName(tags, "PROMO")).toBeUndefined(); // ambiguous
    expect(findTagByName(tags, "other")).toBeUndefined();
  });

  it("summarizeLink reports the destination url as originalUrl", () => {
    const summary = summarizeLink(apiLink({ url: "https://example.com/x" }));
    expect(summary.originalUrl).toBe("https://example.com/x");
    expect(summary).not.toHaveProperty("tags");
  });

  it("missingTags lists requested names the link does not carry", () => {
    const link = apiLink({
      tags: [{ id: "tag_1", name: "news", color: "#6366f1" }],
    });
    expect(missingTags(["news", " q4 ", "q4", ""], link)).toEqual(["q4"]);
    expect(missingTags(undefined, link)).toEqual([]);
  });
});
