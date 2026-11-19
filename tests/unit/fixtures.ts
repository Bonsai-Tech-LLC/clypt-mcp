// Response bodies shaped like the Clypt /api/v1 routes return them.

import type { ClyptLink, ClyptLinkList } from "../../src/types.js";

// A real Response, so a test fails if the client reads a body twice
export function jsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// formatLink() in the API's links routes
export function apiLink(overrides: Partial<ClyptLink> = {}): ClyptLink {
  const shortCode = overrides.shortCode ?? "abc123";
  return {
    id: "clnk_1",
    shortCode,
    shortUrl: `https://clypt.io/${shortCode}`,
    url: "https://example.com/",
    title: null,
    clickCount: 0,
    isActive: true,
    expiresAt: null,
    folderId: null,
    customDomain: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    tags: [],
    createdAt: "2026-11-19T12:00:00.000Z",
    updatedAt: "2026-11-19T12:00:00.000Z",
    ...overrides,
  };
}

// GET /links
export function linkList(
  links: ClyptLink[],
  pagination: Partial<ClyptLinkList["pagination"]> = {}
): ClyptLinkList {
  const limit = pagination.limit ?? 20;
  const total = pagination.total ?? links.length;
  return {
    links,
    pagination: {
      page: 1,
      limit,
      total,
      pages: Math.ceil(total / limit),
      ...pagination,
    },
  };
}

// requireScope() in the API's auth helpers
export function forbidden(scope: string) {
  return jsonResponse(
    {
      error: "Forbidden",
      message: `This action requires the "${scope}" permission. Your API key does not have this scope.`,
      requiredScope: scope,
      docs: "https://clypt.io/docs/api/permissions",
    },
    403
  );
}

// GET /links/:id/analytics
export const linkAnalytics = {
  linkId: "clnk_1",
  shortCode: "abc123",
  url: "https://example.com/",
  period: "7d",
  totalClicks: 12,
  clicksInPeriod: 5,
  timeseries: [{ date: "2026-11-18", count: 5 }],
  topCountries: [{ name: "US", count: 5 }],
  topDevices: [{ name: "desktop", count: 5 }],
  topBrowsers: [{ name: "Chrome", count: 5 }],
  topOS: [{ name: "macOS", count: 5 }],
  topReferrers: [{ name: "Unknown", count: 5 }],
};
