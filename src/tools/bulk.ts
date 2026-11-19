import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";
import { missingTags, tagsNotAppliedWarning } from "../link-tags.js";
import type { ClyptLink } from "../types.js";

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
      const notApplied = new Set<string>();

      for (const url of urls) {
        // Only a failed request counts as a failure: once the API has
        // created the link, report it as created.
        let link: ClyptLink;
        try {
          link = await client.createLink({ url, tags, folderId });
        } catch (error: any) {
          errors.push({
            originalUrl: url,
            error: error.message,
          });
          continue;
        }
        results.push({
          originalUrl: url,
          shortUrl: link.shortUrl,
          shortCode: link.shortCode,
          id: link.id,
        });
        for (const name of missingTags(tags, link)) notApplied.add(name);
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
                ...(notApplied.size > 0 && {
                  warning: tagsNotAppliedWarning([...notApplied], "links"),
                }),
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
