import { ClyptConfig } from "./config.js";
import type {
  ClyptAnalytics,
  ClyptDashboardStats,
  ClyptFolder,
  ClyptLink,
  ClyptLinkList,
  ClyptTag,
} from "./types.js";
import { VERSION } from "./version.js";

// Pages of search results findLinkByShortCode checks (100 links per page)
const SHORT_CODE_SEARCH_PAGES = 5;

// Longest piece of a non-JSON error body (e.g. a proxy's HTML error page)
// kept in an error message
const MAX_ERROR_TEXT_LENGTH = 300;

/**
 * An ID or short code as one URL path segment, so "/", "?" or "#" in it can't
 * send the request to another route. "." and ".." would still be dot segments
 * (even percent-encoded), so they are refused.
 */
function pathSegment(value: string): string {
  if (value === "" || value === "." || value === "..") {
    throw new Error(`Invalid ID: "${value}"`);
  }
  return encodeURIComponent(value);
}

/** A short, single-line version of a non-JSON error body. */
function summarizeErrorText(text: string): string {
  // An HTML error page's title says what went wrong ("502: Bad gateway")
  const title = /<title>([^<]*)<\/title>/i.exec(text)?.[1]?.trim();
  const summary = (title || text).replace(/\s+/g, " ").trim();
  return summary.length > MAX_ERROR_TEXT_LENGTH
    ? `${summary.slice(0, MAX_ERROR_TEXT_LENGTH)}...`
    : summary;
}

/** A non-2xx response from the Clypt API. */
export class ClyptApiError extends Error {
  readonly status: number;
  /** On a 403, the scope the API key lacks (e.g. "analytics:read"). */
  readonly requiredScope?: string;

  constructor(message: string, status: number, requiredScope?: string) {
    super(message);
    this.name = "ClyptApiError";
    this.status = status;
    this.requiredScope = requiredScope;
  }
}

export class ClyptClient {
  private config: ClyptConfig;

  constructor(config: ClyptConfig) {
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": `clypt-mcp/${VERSION}`,
    };
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | undefined>
  ): Promise<T> {
    const url = new URL(`${this.config.baseUrl}/api/v1${path}`);

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const options: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      // A body can only be read once: read it as text, then try JSON
      // ({ error, message, requiredScope }). Proxies may send plain text.
      let errorBody = await response.text();
      let requiredScope: string | undefined;
      try {
        const json = JSON.parse(errorBody);
        errorBody = json.message || json.error || JSON.stringify(json);
        if (typeof json.requiredScope === "string") {
          requiredScope = json.requiredScope;
        }
      } catch {
        // Not JSON: keep a short summary of the text
        errorBody =
          summarizeErrorText(errorBody) ||
          response.statusText ||
          "empty response body";
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new ClyptApiError(
          `Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : "Please wait and try again."}`,
          response.status
        );
      }

      throw new ClyptApiError(
        `Clypt API error (${response.status}): ${errorBody}`,
        response.status,
        requiredScope
      );
    }

    return response.json() as Promise<T>;
  }

  // Links
  async createLink(data: {
    url: string;
    slug?: string;
    tags?: string[];
    expiresAt?: string;
    password?: string;
    folderId?: string;
  }) {
    // The API reads the short code from `customCode`; newer servers also
    // accept `slug`, so send both. `tags` are tag names, which servers that
    // read only `tagIds` ignore (the tools check the returned link's tags).
    return this.request<ClyptLink>("POST", "/links", {
      ...data,
      customCode: data.slug,
    });
  }

  async listLinks(params?: {
    page?: number;
    limit?: number;
    search?: string;
    tagId?: string;
    folderId?: string;
  }) {
    return this.request<ClyptLinkList>(
      "GET",
      "/links",
      undefined,
      params as Record<string, string | number | undefined>
    );
  }

  /**
   * Find a link by its exact short code. The API looks links up by ID only,
   * so this searches (which also matches URLs and titles) and compares
   * shortCode. Returns null if no link has that code.
   */
  async findLinkByShortCode(shortCode: string): Promise<ClyptLink | null> {
    if (!shortCode) return null;
    for (let page = 1; page <= SHORT_CODE_SEARCH_PAGES; page++) {
      const { links, pagination } = await this.listLinks({
        search: shortCode,
        limit: 100,
        page,
      });
      const match = links.find((link) => link.shortCode === shortCode);
      if (match) return match;
      if (page >= pagination.pages) break;
    }
    return null;
  }

  async getLink(id: string) {
    return this.request<ClyptLink>("GET", `/links/${pathSegment(id)}`);
  }

  // PATCH /links/:id cannot change a link's short code or tags
  async updateLink(
    id: string,
    data: {
      url?: string;
      title?: string | null;
      isActive?: boolean;
      expiresAt?: string | null;
      password?: string | null;
      folderId?: string | null;
    }
  ) {
    return this.request<ClyptLink>("PATCH", `/links/${pathSegment(id)}`, data);
  }

  async deleteLink(id: string) {
    return this.request<{ message: string; id: string }>(
      "DELETE",
      `/links/${pathSegment(id)}`
    );
  }

  // Analytics
  async getLinkAnalytics(id: string, period?: string) {
    return this.request<ClyptAnalytics>(
      "GET",
      `/links/${pathSegment(id)}/analytics`,
      undefined,
      period ? { period } : undefined
    );
  }

  async getDashboardStats() {
    return this.request<ClyptDashboardStats>("GET", "/analytics");
  }

  // Tags
  async createTag(data: { name: string; color?: string }) {
    return this.request<ClyptTag>("POST", "/tags", data);
  }

  async listTags() {
    return this.request<{ tags: ClyptTag[] }>("GET", "/tags");
  }

  // Folders
  async createFolder(data: { name: string; parentId?: string }) {
    return this.request<ClyptFolder>("POST", "/folders", data);
  }

  async listFolders() {
    return this.request<{ folders: ClyptFolder[] }>("GET", "/folders");
  }

  // A/B Testing
  async createAbTest(
    linkId: string,
    variants: { url: string; label?: string; weight: number }[]
  ) {
    return this.request<any>("POST", `/links/${pathSegment(linkId)}/test`, {
      variants,
    });
  }

  async getAbTestResults(linkId: string) {
    return this.request<any>("GET", `/links/${pathSegment(linkId)}/test`);
  }

  async updateAbTestWeights(
    linkId: string,
    variants: { id: string; weight: number }[]
  ) {
    return this.request<any>("PATCH", `/links/${pathSegment(linkId)}/test`, {
      variants,
    });
  }

  async endAbTest(linkId: string) {
    return this.request<any>("DELETE", `/links/${pathSegment(linkId)}/test`);
  }

  async promoteAbTestWinner(linkId: string, variantId: string) {
    return this.request<any>(
      "POST",
      `/links/${pathSegment(linkId)}/test/promote`,
      { variantId }
    );
  }

  // AI Artistic QR Codes
  async generateAiQr(data: {
    linkId: string;
    prompt?: string;
    style?: string;
    negativePrompt?: string;
    controlWeight?: number;
    seed?: number;
  }) {
    return this.request<any>("POST", "/qr/ai", data);
  }

  async getAiQrStatus(id: string) {
    return this.request<any>("GET", `/qr/ai/${pathSegment(id)}`);
  }

  async listAiQrStyles() {
    return this.request<{ styles: { id: string; name: string }[] }>(
      "GET",
      "/qr/ai"
    );
  }
}
