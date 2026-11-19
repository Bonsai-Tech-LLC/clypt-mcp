import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptApiError, ClyptClient } from "../client.js";

/**
 * Analytics for a link given its ID or short code. The API accepts only IDs,
 * so when it answers 404 the value is looked up as a short code.
 */
export async function getAnalyticsForLink(
  client: ClyptClient,
  linkId: string,
  period?: string
) {
  try {
    return await client.getLinkAnalytics(linkId, period);
  } catch (error) {
    if (!(error instanceof ClyptApiError && error.status === 404)) throw error;
    const link = await client.findLinkByShortCode(linkId);
    if (!link) {
      throw new Error(
        `Link not found: no link has the ID or short code "${linkId}".`
      );
    }
    return client.getLinkAnalytics(link.id, period);
  }
}

export function registerGetLinkAnalytics(
  server: McpServer,
  client: ClyptClient
) {
  server.tool(
    "get_link_analytics",
    "Get click analytics for a specific link, including top countries, devices, and referrers. Needs an API key with the analytics:read scope.",
    {
      linkId: z
        .string()
        .describe(
          "The link ID, or its short code (e.g. 'abc123' for clypt.io/abc123)"
        ),
      period: z
        .enum(["24h", "7d", "30d", "90d"])
        .optional()
        .describe("Time period for analytics (default: 30d)"),
    },
    async ({ linkId, period }) => {
      try {
        const result = await getAnalyticsForLink(client, linkId, period);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof ClyptApiError && error.status === 403) {
          const scope = error.requiredScope ?? "analytics:read";
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: get_link_analytics needs an API key with the "${scope}" scope, and this key doesn't have it. Create a key that includes it at https://clypt.io/dashboard/settings and set it as CLYPT_API_KEY. (${error.message})`,
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
    }
  );
}

export function registerGetDashboardStats(
  server: McpServer,
  client: ClyptClient
) {
  server.tool(
    "get_dashboard_stats",
    "Get high-level dashboard statistics: total links, total clicks, and top-performing links.",
    {},
    async () => {
      const result = await client.getDashboardStats();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
