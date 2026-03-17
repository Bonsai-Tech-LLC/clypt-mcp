import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";

export function registerBulkShorten(server: McpServer, client: ClyptClient) {
  server.tool(
    "bulk_shorten",
    "Shorten multiple URLs at once. Returns an array of short links.",
    {
      urls: z
        .array(z.string().url())
        .min(1)
        .max(25)
        .describe("Array of URLs to shorten (max 25)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags to apply to all links"),
      folderId: z
        .string()
        .optional()
        .describe("Folder ID to organize all links into"),
    },
    async ({ urls, tags, folderId }) => {
      const results: any[] = [];
      const errors: any[] = [];

      for (const url of urls) {
        try {
          const result = await client.createLink({ url, tags, folderId });
          results.push({
            originalUrl: url,
            shortUrl: result.link.shortUrl,
            shortCode: result.link.shortCode,
            id: result.link.id,
          });
        } catch (error: any) {
          errors.push({
            originalUrl: url,
            error: error.message,
          });
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                created: results.length,
                failed: errors.length,
                links: results,
                ...(errors.length > 0 && { errors }),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
