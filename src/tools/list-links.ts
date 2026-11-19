import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptApiError, ClyptClient } from "../client.js";
import type { ClyptLink, ClyptTag } from "../types.js";

// Page size the API uses when no limit is sent
const DEFAULT_LIMIT = 20;

/** The compact view of a link that list_links returns. */
export function summarizeLink(link: ClyptLink) {
  return {
    id: link.id,
    shortUrl: link.shortUrl,
    shortCode: link.shortCode,
    originalUrl: link.url,
    clickCount: link.clickCount,
    createdAt: link.createdAt,
    ...(link.tags?.length && { tags: link.tags }),
  };
}

/**
 * The API pages by page number. Converts the tool's older offset argument to
 * a page, or returns null when the offset is not a multiple of the limit.
 */
export function offsetToPage(offset: number, limit: number): number | null {
  return offset % limit === 0 ? offset / limit + 1 : null;
}

/** Exact name match first, then a single case-insensitive match. */
export function findTagByName(
  tags: ClyptTag[],
  name: string
): ClyptTag | undefined {
  const wanted = name.trim();
  const exact = tags.find((tag) => tag.name === wanted);
  if (exact) return exact;
  const matches = tags.filter(
    (tag) => tag.name.toLowerCase() === wanted.toLowerCase()
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function errorResult(text: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${text}` }],
    isError: true,
  };
}

export function registerListLinks(server: McpServer, client: ClyptClient) {
  server.tool(
    "list_links",
    "List your shortened links with optional search and filtering, newest first, one page at a time.",
    {
      search: z
        .string()
        .optional()
        .describe("Search by URL, title, or short code"),
      tag: z
        .string()
        .optional()
        .describe(
          "Filter by tag name. Looking up the name needs the tags:read scope; without it, use tagId."
        ),
      tagId: z
        .string()
        .optional()
        .describe(
          "Filter by tag ID (shown in each link's tags). Takes precedence over tag."
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of results per page (default 20, max 100)"),
      page: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Page number, starting at 1 (default 1)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          "Deprecated: use page. Must be a multiple of limit; ignored when page is given."
        ),
    },
    async ({ search, tag, tagId, limit, page, offset }) => {
      const pageSize = limit ?? DEFAULT_LIMIT;

      let pageNumber = page;
      if (pageNumber === undefined && offset !== undefined) {
        const fromOffset = offsetToPage(offset, pageSize);
        if (fromOffset === null) {
          return errorResult(
            `offset ${offset} is not a multiple of limit ${pageSize}. The API pages by page number: use page instead (page 1 is the first ${pageSize} links).`
          );
        }
        pageNumber = fromOffset;
      }

      // The API filters by tag ID, so look a tag name up first
      let filterTagId = tagId;
      if (!filterTagId && tag) {
        let tags: ClyptTag[];
        try {
          tags = (await client.listTags()).tags;
        } catch (error) {
          if (error instanceof ClyptApiError && error.status === 403) {
            return errorResult(
              `Filtering by tag name needs the "tags:read" scope to look up the tag's ID, and this API key doesn't have it. Pass tagId instead (each link's tags in list_links results include their IDs), or use a key that includes "tags:read" (create one at https://clypt.io/dashboard/settings).`
            );
          }
          throw error;
        }
        const match = findTagByName(tags, tag);
        if (!match) {
          return errorResult(
            `No tag named "${tag}". Use manage_tags with action "list" to see your tags.`
          );
        }
        filterTagId = match.id;
      }

      const result = await client.listLinks({
        search,
        tagId: filterTagId,
        limit: pageSize,
        page: pageNumber,
      });

      const summary = result.links.map(summarizeLink);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total: result.pagination.total,
                page: result.pagination.page,
                pages: result.pagination.pages,
                count: summary.length,
                links: summary,
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
