import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClyptApiError, ClyptClient } from "../../src/client.js";
import { VERSION } from "../../src/version.js";
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
      mockFetch.mockResolvedValue(jsonResponse(linkList([])));
      await client.listLinks();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBe("Bearer clypt_testkey123");
    });

    it("sends a User-Agent with the package version", async () => {
      mockFetch.mockResolvedValue(jsonResponse(linkList([])));
      await client.listLinks();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers["User-Agent"]).toBe(`clypt-mcp/${VERSION}`);
    });

    it("builds correct URL with base path", async () => {
      mockFetch.mockResolvedValue(jsonResponse(linkList([])));
      await client.listLinks();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("https://clypt.io/api/v1/links");
    });

    it("appends query params correctly", async () => {
      mockFetch.mockResolvedValue(jsonResponse(linkList([])));
      await client.listLinks({ search: "test", limit: 10 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("search=test");
      expect(url).toContain("limit=10");
    });

    it("skips undefined/null/empty query params", async () => {
      mockFetch.mockResolvedValue(jsonResponse(linkList([])));
      await client.listLinks({ search: undefined, limit: 20 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("search=");
      expect(url).toContain("limit=20");
    });

    it("sends JSON body for POST requests", async () => {
      mockFetch.mockResolvedValue(jsonResponse(apiLink(), 201));
      await client.createLink({ url: "https://example.com" });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ url: "https://example.com" });
    });

    it("sends JSON body for PATCH requests", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(apiLink({ url: "https://new.com/" }))
      );
      await client.updateLink("link_1", { url: "https://new.com" });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body)).toEqual({ url: "https://new.com" });
    });

    it("does not send body for GET requests", async () => {
      mockFetch.mockResolvedValue(jsonResponse(linkList([])));
      await client.listLinks();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("GET");
      expect(options.body).toBeUndefined();
    });

    it("throws on rate limit (429) with retry message", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          {
            error: "Too Many Requests",
            message: "Rate limit exceeded. Maximum 100 requests per minute.",
            retryAfter: 30,
          },
          429,
          { "Retry-After": "30" }
        )
      );

      await expect(client.listLinks()).rejects.toThrow(
        "Rate limit exceeded. Retry after 30 seconds."
      );
    });

    it("throws with error message from API on failure", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          {
            error: "Unauthorized",
            message: "Missing or invalid authentication.",
            docs: "https://clypt.io/docs/api/authentication",
          },
          401
        )
      );

      await expect(client.listLinks()).rejects.toThrow(
        "Clypt API error (401): Missing or invalid authentication."
      );
    });

    it("throws with text body when JSON parse fails", async () => {
      mockFetch.mockResolvedValue(new Response("Bad Gateway", { status: 502 }));

      await expect(client.listLinks()).rejects.toThrow(
        "Clypt API error (502): Bad Gateway"
      );
    });

    it("reports an HTML error page by its title, not the whole page", async () => {
      const page = `<!DOCTYPE html><html><head><title>clypt.io | 502: Bad gateway</title></head><body>${"<p>details</p>".repeat(5000)}</body></html>`;
      mockFetch.mockResolvedValue(
        new Response(page, {
          status: 502,
          headers: { "Content-Type": "text/html" },
        })
      );

      const error = await client.listLinks().catch((e: unknown) => e);
      expect((error as Error).message).toBe(
        "Clypt API error (502): clypt.io | 502: Bad gateway"
      );
    });

    it("shortens a long non-JSON error body", async () => {
      mockFetch.mockResolvedValue(
        new Response(`upstream failed\n\n${"x".repeat(5000)}`, { status: 503 })
      );

      const error = await client.listLinks().catch((e: unknown) => e);
      const { message } = error as Error;
      expect(message).toMatch(
        /^Clypt API error \(503\): upstream failed x+\.\.\.$/
      );
      expect(message.length).toBeLessThan(400);
    });

    it("falls back to the status text when the error body is empty", async () => {
      mockFetch.mockResolvedValue(
        new Response("", { status: 504, statusText: "Gateway Timeout" })
      );

      await expect(client.listLinks()).rejects.toThrow(
        "Clypt API error (504): Gateway Timeout"
      );
    });

    it("throws a ClyptApiError with the status and the scope the key lacks", async () => {
      mockFetch.mockResolvedValue(forbidden("analytics:read"));

      const error = await client
        .getLinkAnalytics("clnk_1")
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ClyptApiError);
      expect(error).toMatchObject({
        status: 403,
        requiredScope: "analytics:read",
      });
      expect((error as Error).message).toContain(
        'requires the "analytics:read" permission'
      );
    });
  });

  describe("Links", () => {
    it("createLink sends the slug as customCode and slug, and tag names", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          apiLink({
            shortCode: "abc",
            tags: [{ id: "tag_1", name: "news", color: "#6366f1" }],
          }),
          201
        )
      );
      const result = await client.createLink({
        url: "https://example.com",
        slug: "abc",
        tags: ["news"],
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://clypt.io/api/v1/links");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({
        url: "https://example.com",
        customCode: "abc",
        slug: "abc",
        tags: ["news"],
      });
      // The API returns the link itself, not { link }
      expect(result.shortCode).toBe("abc");
      expect(result.shortUrl).toBe("https://clypt.io/abc");
      expect(result.url).toBe("https://example.com/");
    });

    it("listLinks sends the API's paging and filter params", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(linkList([apiLink()], { page: 2, limit: 50, total: 51 }))
      );
      const result = await client.listLinks({
        page: 2,
        limit: 50,
        search: "promo",
        tagId: "tag_1",
        folderId: "fold_1",
      });

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(Object.fromEntries(url.searchParams)).toEqual({
        page: "2",
        limit: "50",
        search: "promo",
        tagId: "tag_1",
        folderId: "fold_1",
      });
      expect(result.pagination).toEqual({
        page: 2,
        limit: 50,
        total: 51,
        pages: 2,
      });
      expect(result.links[0].url).toBe("https://example.com/");
    });

    it("findLinkByShortCode returns the exact match from search results", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          linkList([
            apiLink({ id: "clnk_x", shortCode: "abc123x" }),
            apiLink({ id: "clnk_upper", shortCode: "ABC123" }),
            apiLink({ id: "clnk_abc", shortCode: "abc123" }),
          ])
        )
      );
      const link = await client.findLinkByShortCode("abc123");

      expect(link?.id).toBe("clnk_abc");
      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.pathname).toBe("/api/v1/links");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        search: "abc123",
        limit: "100",
        page: "1",
      });
    });

    it("findLinkByShortCode reads further pages and returns null without a match", async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse(
            linkList([apiLink({ shortCode: "go-home" })], {
              limit: 100,
              total: 101,
            })
          )
        )
        .mockResolvedValueOnce(
          jsonResponse(
            linkList([apiLink({ shortCode: "go-away" })], {
              page: 2,
              limit: 100,
              total: 101,
            })
          )
        );

      expect(await client.findLinkByShortCode("go")).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(new URL(mockFetch.mock.calls[1][0]).searchParams.get("page")).toBe(
        "2"
      );
    });

    it("findLinkByShortCode stops after 5 pages of results", async () => {
      mockFetch.mockImplementation(async () =>
        jsonResponse(
          linkList([apiLink({ shortCode: "go-home" })], {
            limit: 100,
            total: 10_000,
          })
        )
      );

      expect(await client.findLinkByShortCode("go")).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it("sends an ID or short code as a single path segment", async () => {
      mockFetch.mockImplementation(async () => jsonResponse({}));

      await client.getLinkAnalytics("abc?x=1#y", "7d");
      await client.deleteLink("../tags/tag_1");

      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
        "https://clypt.io/api/v1/links/abc%3Fx%3D1%23y/analytics?period=7d",
        "https://clypt.io/api/v1/links/..%2Ftags%2Ftag_1",
      ]);
    });

    it("refuses IDs that would be read as dot segments", async () => {
      await expect(client.deleteLink("..")).rejects.toThrow('Invalid ID: ".."');
      await expect(client.getLinkAnalytics(".")).rejects.toThrow(
        'Invalid ID: "."'
      );
      await expect(client.getLink("")).rejects.toThrow('Invalid ID: ""');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("getLink sends GET to /links/:id and returns the link", async () => {
      mockFetch.mockResolvedValue(jsonResponse(apiLink({ id: "link_1" })));
      const result = await client.getLink("link_1");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1");
      expect(result.id).toBe("link_1");
    });

    it("deleteLink sends DELETE to /links/:id", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ message: "Link deleted successfully", id: "link_1" })
      );
      await client.deleteLink("link_1");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1");
      expect(options.method).toBe("DELETE");
    });
  });

  describe("Analytics", () => {
    it("getLinkAnalytics sends correct path and period", async () => {
      mockFetch.mockResolvedValue(jsonResponse(linkAnalytics));
      const result = await client.getLinkAnalytics("link_1", "7d");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1/analytics");
      expect(url).toContain("period=7d");
      expect(result.totalClicks).toBe(12);
    });

    it("getDashboardStats sends GET to /analytics", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          period: "30d",
          totalLinks: 50,
          totalClicks: 1000,
          clicksInPeriod: 200,
          timeseries: [],
          topLinks: [],
          topCountries: [],
          topDevices: [],
          topBrowsers: [],
          topReferrers: [],
        })
      );
      const result = await client.getDashboardStats();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/analytics");
      expect(result.totalLinks).toBe(50);
    });
  });

  describe("Tags", () => {
    it("createTag sends POST to /tags and returns the tag", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          {
            id: "t1",
            name: "marketing",
            color: "#ff0000",
            userId: "user_1",
            createdAt: "2026-11-19T12:00:00.000Z",
          },
          201
        )
      );
      const result = await client.createTag({
        name: "marketing",
        color: "#ff0000",
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/tags");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({
        name: "marketing",
        color: "#ff0000",
      });
      expect(result.id).toBe("t1");
      expect(result.name).toBe("marketing");
    });

    it("listTags sends GET to /tags", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          tags: [
            {
              id: "t1",
              name: "marketing",
              color: "#6366f1",
              linkCount: 3,
              createdAt: "2026-11-19T12:00:00.000Z",
            },
          ],
        })
      );
      const result = await client.listTags();

      expect(result.tags).toHaveLength(1);
    });
  });

  describe("Folders", () => {
    it("createFolder sends POST to /folders and returns the folder", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          {
            id: "f1",
            name: "campaigns",
            parentId: null,
            linkCount: 0,
            subfolderCount: 0,
            createdAt: "2026-11-19T12:00:00.000Z",
          },
          201
        )
      );
      const result = await client.createFolder({ name: "campaigns" });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("POST");
      expect(result.id).toBe("f1");
      expect(result.name).toBe("campaigns");
    });

    it("listFolders sends GET to /folders", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ folders: [] }));
      const result = await client.listFolders();

      expect(result.folders).toEqual([]);
    });
  });

  describe("A/B Testing", () => {
    it("createAbTest sends POST to /links/:id/test", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          {
            linkId: "link_1",
            isActive: true,
            variants: [
              { id: "v1", url: "https://a.com", label: "Control", weight: 50 },
              { id: "v2", url: "https://b.com", label: "Variant", weight: 50 },
            ],
          },
          201
        )
      );
      await client.createAbTest("link_1", [
        { url: "https://a.com", label: "Control", weight: 50 },
        { url: "https://b.com", label: "Variant", weight: 50 },
      ]);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1/test");
      expect(options.method).toBe("POST");
    });

    it("getAbTestResults sends GET to /links/:id/test", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          linkId: "link_1",
          isActive: true,
          duration: "2d 3h",
          startedAt: "2026-11-17T09:00:00.000Z",
          totalClicks: 0,
          variants: [],
          significance: null,
        })
      );
      await client.getAbTestResults("link_1");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1/test");
      expect(options.method).toBe("GET");
    });

    it("promoteAbTestWinner sends POST to /links/:id/test/promote", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          success: true,
          message: 'Winner promoted! "Variant" is now the sole destination.',
          newUrl: "https://b.com",
        })
      );
      await client.promoteAbTestWinner("link_1", "variant_1");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1/test/promote");
      expect(JSON.parse(options.body)).toEqual({ variantId: "variant_1" });
    });

    it("endAbTest sends DELETE to /links/:id/test", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          success: true,
          message: "A/B test ended. Link reverted to original URL.",
        })
      );
      await client.endAbTest("link_1");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/links/link_1/test");
      expect(options.method).toBe("DELETE");
    });
  });

  describe("AI QR Codes", () => {
    it("generateAiQr sends POST to /qr/ai", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          { id: "qr_1", status: "generating", estimatedSeconds: 35, remaining: 9 },
          201
        )
      );
      await client.generateAiQr({ linkId: "link_1", prompt: "neon city" });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/qr/ai");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toMatchObject({
        linkId: "link_1",
        prompt: "neon city",
      });
    });

    it("getAiQrStatus sends GET to /qr/ai/:id", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          id: "qr_1",
          status: "ready",
          imageUrl: "https://example.com/qr.png",
          scanVerified: true,
          prompt: "neon city",
          style: null,
        })
      );
      await client.getAiQrStatus("qr_1");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/qr/ai/qr_1");
    });

    it("listAiQrStyles sends GET to /qr/ai", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ styles: [{ id: "cyberpunk", name: "Cyberpunk" }] })
      );
      const result = await client.listAiQrStyles();

      expect(result.styles).toHaveLength(1);
    });
  });
});
