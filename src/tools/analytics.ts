import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";

export function registerGetLinkAnalytics(
  server: McpServer,
  client: ClyptClient
) {
  server.tool(
    "get_link_analytics",
    "Get click analytics for a specific link, including top countries, devices, and referrers.",
    {
      linkId: z.string().describe("The link ID or short code"),
      period: z
        .enum(["7d", "30d", "90d", "all"])
        .optional()
        .describe("Time period for analytics (default: 30d)"),
    },
    async ({ linkId, period }) => {
      const result = await client.getLinkAnalytics(linkId, period);

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
