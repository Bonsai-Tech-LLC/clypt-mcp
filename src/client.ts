import { ClyptConfig } from "./config.js";

export class ClyptClient {
  private config: ClyptConfig;

  constructor(config: ClyptConfig) {
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "clypt-mcp/1.0.0",
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
      let errorBody: string;
      try {
        const json = await response.json();
        errorBody = json.message || json.error || JSON.stringify(json);
      } catch {
        errorBody = await response.text();
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new Error(
          `Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : "Please wait and try again."}`
        );
      }

      throw new Error(
        `Clypt API error (${response.status}): ${errorBody}`
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
    return this.request<{ link: any }>("POST", "/links", data);
  }

  async listLinks(params?: {
    search?: string;
    tag?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.request<{ links: any[]; total: number }>(
      "GET",
      "/links",
      undefined,
      params as Record<string, string | number | undefined>
    );
  }

  async getLink(id: string) {
    return this.request<{ link: any }>("GET", `/links/${id}`);
  }

  async updateLink(
    id: string,
    data: {
      url?: string;
      slug?: string;
      tags?: string[];
      expiresAt?: string | null;
      password?: string | null;
      folderId?: string | null;
    }
  ) {
    return this.request<{ link: any }>("PATCH", `/links/${id}`, data);
  }

  async deleteLink(id: string) {
    return this.request<{ message: string }>("DELETE", `/links/${id}`);
  }

  // Analytics
  async getLinkAnalytics(id: string, period?: string) {
    return this.request<any>(
      "GET",
      `/links/${id}/analytics`,
      undefined,
      period ? { period } : undefined
    );
  }

  async getDashboardStats() {
    return this.request<any>("GET", "/analytics");
  }

  // Tags
  async createTag(data: { name: string; color?: string }) {
    return this.request<{ tag: any }>("POST", "/tags", data);
  }

  async listTags() {
    return this.request<{ tags: any[] }>("GET", "/tags");
  }

  // Folders
  async createFolder(data: { name: string; parentId?: string }) {
    return this.request<{ folder: any }>("POST", "/folders", data);
  }

  async listFolders() {
    return this.request<{ folders: any[] }>("GET", "/folders");
  }

  // A/B Testing
  async createAbTest(
    linkId: string,
    variants: { url: string; label?: string; weight: number }[]
  ) {
    return this.request<any>("POST", `/links/${linkId}/test`, { variants });
  }

  async getAbTestResults(linkId: string) {
    return this.request<any>("GET", `/links/${linkId}/test`);
  }

  async updateAbTestWeights(
    linkId: string,
    variants: { id: string; weight: number }[]
  ) {
    return this.request<any>("PATCH", `/links/${linkId}/test`, { variants });
  }

  async endAbTest(linkId: string) {
    return this.request<any>("DELETE", `/links/${linkId}/test`);
  }

  async promoteAbTestWinner(linkId: string, variantId: string) {
    return this.request<any>("POST", `/links/${linkId}/test/promote`, {
      variantId,
    });
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
    return this.request<any>("GET", `/qr/ai/${id}`);
  }

  async listAiQrStyles() {
    return this.request<{ styles: { id: string; name: string }[] }>(
      "GET",
      "/qr/ai"
    );
  }
}
