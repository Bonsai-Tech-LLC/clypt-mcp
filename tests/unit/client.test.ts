import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClyptClient } from "../../src/client.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers)),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

describe("ClyptClient", () => {
  let client: ClyptClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new ClyptClient({
      apiKey: "clypt_testkey123",
      baseUrl: "https://clypt.io",
    });
  });

  describe("request()", () => {
    it("sends correct Authorization header", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ links: [], total: 0 }));
      await client.listLinks();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBe("Bearer clypt_testkey123");
    });

    it("sends correct User-Agent header", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ links: [], total: 0 }));
      await client.listLinks();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers["User-Agent"]).toBe("clypt-mcp/1.0.0");
    });

    it("builds correct URL with base path", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ links: [], total: 0 }));
      await client.listLinks();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("https://clypt.io/api/v1/links");
    });

    it("appends query params correctly", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ links: [], total: 0 }));
      await client.listLinks({ search: "test", limit: 10 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("search=test");
      expect(url).toContain("limit=10");
    });

    it("skips undefined/null/empty query params", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ links: [], total: 0 }));
      await client.listLinks({ search: undefined, limit: 20 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("search=");
      expect(url).toContain("limit=20");
    });

    it("sends JSON body for POST requests", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ link: { id: "1", shortUrl: "https://clypt.io/abc" } })
      );
      await client.createLink({ url: "https://example.com" });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ url: "https://example.com" });
    });

    it("sends JSON body for PATCH requests", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ link: { id: "1", url: "https://new.com" } })
      );
      await client.updateLink("link_1", { url: "https://new.com" });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body)).toEqual({ url: "https://new.com" });
    });

    it("does not send body for GET requests", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ links: [], total: 0 }));
      await client.listLinks();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("GET");
      expect(options.body).toBeUndefined();
    });

    it("throws on rate limit (429) with retry message", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ error: "Too Many Requests" }, 429, { "Retry-After": "30" })
      );

      await expect(client.listLinks()).rejects.toThrow("Rate limit exceeded");
    });

    it("throws with error message from API on failure", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ error: "Unauthorized" }, 401)
      );

      await expect(client.listLinks()).rejects.toThrow("Clypt API error (401)");
    });

    it("throws with text body when JSON parse fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        headers: new Map(),
        json: () => Promise.reject(new Error("not json")),
        text: () => Promise.resolve("Bad Gateway"),
      });

      await expect(client.listLinks()).rejects.toThrow("Bad Gateway");
    });
  });

  describe("Links", () => {
    it("createLink sends POST to /links", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ link: { id: "1", shortUrl: "https://clypt.io/abc", shortCode: "abc" } })
      );
      const result = await client.createLink({ url: "https://example.com", slug: "abc" });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links");
      expect(options.method).toBe("POST");
      expect(result.link.shortCode).toBe("abc");
    });

    it("getLink sends GET to /links/:id", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ link: { id: "link_1", shortUrl: "https://clypt.io/abc" } })
      );
      await client.getLink("link_1");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1");
    });

    it("deleteLink sends DELETE to /links/:id", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: "Deleted" }));
      await client.deleteLink("link_1");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1");
      expect(options.method).toBe("DELETE");
    });
  });

  describe("Analytics", () => {
    it("getLinkAnalytics sends correct path and period", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ clicks: 100 }));
      await client.getLinkAnalytics("link_1", "7d");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1/analytics");
      expect(url).toContain("period=7d");
    });

    it("getDashboardStats sends GET to /analytics", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ totalLinks: 50, totalClicks: 1000 }));
      const result = await client.getDashboardStats();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/analytics");
      expect(result.totalLinks).toBe(50);
    });
  });

  describe("Tags", () => {
    it("createTag sends POST to /tags", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ tag: { id: "t1", name: "marketing" } }));
      await client.createTag({ name: "marketing", color: "#ff0000" });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/tags");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ name: "marketing", color: "#ff0000" });
    });

    it("listTags sends GET to /tags", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ tags: [{ id: "t1", name: "marketing" }] }));
      const result = await client.listTags();

      expect(result.tags).toHaveLength(1);
    });
  });

  describe("Folders", () => {
    it("createFolder sends POST to /folders", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ folder: { id: "f1", name: "campaigns" } }));
      await client.createFolder({ name: "campaigns" });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("POST");
    });

    it("listFolders sends GET to /folders", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ folders: [] }));
      const result = await client.listFolders();

      expect(result.folders).toEqual([]);
    });
  });

  describe("A/B Testing", () => {
    it("createAbTest sends POST to /links/:id/test", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ test: { id: "test_1" } }));
      await client.createAbTest("link_1", [
        { url: "https://a.com", label: "Control", weight: 50 },
        { url: "https://b.com", label: "Variant", weight: 50 },
      ]);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1/test");
      expect(options.method).toBe("POST");
    });

    it("getAbTestResults sends GET to /links/:id/test", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ variants: [], confident: false }));
      await client.getAbTestResults("link_1");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1/test");
      expect(options.method).toBe("GET");
    });

    it("promoteAbTestWinner sends POST to /links/:id/test/promote", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ promoted: true }));
      await client.promoteAbTestWinner("link_1", "variant_1");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1/test/promote");
      expect(JSON.parse(options.body)).toEqual({ variantId: "variant_1" });
    });

    it("endAbTest sends DELETE to /links/:id/test", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ ended: true }));
      await client.endAbTest("link_1");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1/test");
      expect(options.method).toBe("DELETE");
    });
  });

  describe("AI QR Codes", () => {
    it("generateAiQr sends POST to /qr/ai", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: "qr_1", status: "GENERATING" }));
      await client.generateAiQr({ linkId: "link_1", prompt: "neon city" });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/qr/ai");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toMatchObject({ linkId: "link_1", prompt: "neon city" });
    });

    it("getAiQrStatus sends GET to /qr/ai/:id", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: "qr_1", status: "READY", imageUrl: "https://..." }));
      await client.getAiQrStatus("qr_1");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/qr/ai/qr_1");
    });

    it("listAiQrStyles sends GET to /qr/ai", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ styles: [{ id: "neon", name: "Neon" }] }));
      const result = await client.listAiQrStyles();

      expect(result.styles).toHaveLength(1);
    });
  });
});
