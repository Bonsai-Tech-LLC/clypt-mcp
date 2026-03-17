import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";

export function registerManageTags(server: McpServer, client: ClyptClient) {
  server.tool(
    "manage_tags",
    "Create or list tags for organizing your links.",
    {
      action: z
        .enum(["create", "list"])
        .describe("Action to perform: 'create' a new tag or 'list' all tags"),
      name: z
        .string()
        .optional()
        .describe("Tag name (required for 'create')"),
      color: z
        .string()
        .optional()
        .describe("Tag color as hex (e.g., '#ff5733'). Optional for 'create'."),
    },
    async ({ action, name, color }) => {
      if (action === "create") {
        if (!name) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: 'name' is required when creating a tag.",
              },
            ],
            isError: true,
          };
        }
        const result = await client.createTag({ name, color });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result.tag, null, 2),
            },
          ],
        };
      }

      // list
      const result = await client.listTags();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { count: result.tags.length, tags: result.tags },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
