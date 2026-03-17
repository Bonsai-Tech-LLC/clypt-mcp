import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";

export function registerShortenLink(server: McpServer, client: ClyptClient) {
  server.tool(
    "shorten_link",
    "Create a shortened Clypt link. Returns the short URL and metadata.",
    {
      url: z.string().url().describe("The URL to shorten"),
      slug: z
        .string()
        .optional()
        .describe("Custom short code (e.g., 'my-link'). Auto-generated if not provided."),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags to attach to the link"),
      expiresAt: z
        .string()
        .optional()
        .describe("Expiration date in ISO 8601 format"),
      password: z
        .string()
        .optional()
        .describe("Password to protect the link"),
      folderId: z
        .string()
        .optional()
        .describe("Folder ID to organize the link into"),
    },
    async ({ url, slug, tags, expiresAt, password, folderId }) => {
      const result = await client.createLink({
        url,
        slug,
        tags,
        expiresAt,
        password,
        folderId,
      });

      const link = result.link;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                shortUrl: link.shortUrl,
                shortCode: link.shortCode,
                originalUrl: link.originalUrl,
                id: link.id,
                createdAt: link.createdAt,
                ...(link.expiresAt && { expiresAt: link.expiresAt }),
                ...(link.tags?.length && { tags: link.tags }),
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
