import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";

export function registerManageFolders(server: McpServer, client: ClyptClient) {
  server.tool(
    "manage_folders",
    "Create or list folders for organizing your links.",
    {
      action: z
        .enum(["create", "list"])
        .describe(
          "Action to perform: 'create' a new folder or 'list' all folders"
        ),
      name: z
        .string()
        .optional()
        .describe("Folder name (required for 'create')"),
      parentId: z
        .string()
        .optional()
        .describe("Parent folder ID for nesting (optional for 'create')"),
    },
    async ({ action, name, parentId }) => {
      if (action === "create") {
        if (!name) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: 'name' is required when creating a folder.",
              },
            ],
            isError: true,
          };
        }
        const result = await client.createFolder({ name, parentId });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result.folder, null, 2),
            },
          ],
        };
      }

      // list
      const result = await client.listFolders();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { count: result.folders.length, folders: result.folders },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
