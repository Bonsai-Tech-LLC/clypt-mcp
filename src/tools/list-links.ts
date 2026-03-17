import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";

export function registerListLinks(server: McpServer, client: ClyptClient) {
  server.tool(
    "list_links",
    "List your shortened links with optional search and filtering.",
    {
      search: z
        .string()
        .optional()
        .describe("Search by URL, title, or short code"),
      tag: z.string().optional().describe("Filter by tag name"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of results (default 20, max 100)"),
      offset: z.number().min(0).optional().describe("Pagination offset"),
    },
    async ({ search, tag, limit, offset }) => {
      const result = await client.listLinks({ search, tag, limit, offset });

      const summary = result.links.map((link: any) => ({
        id: link.id,
        shortUrl: link.shortUrl,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        clickCount: link.clickCount,
        createdAt: link.createdAt,
        ...(link.tags?.length && { tags: link.tags }),
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { total: result.total, count: summary.length, links: summary },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
