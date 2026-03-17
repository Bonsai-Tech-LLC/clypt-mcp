import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";

export function registerDeleteLink(server: McpServer, client: ClyptClient) {
  server.tool(
    "delete_link",
    "Delete a shortened link by its ID.",
    {
      linkId: z.string().describe("The link ID to delete"),
    },
    async ({ linkId }) => {
      const result = await client.deleteLink(linkId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                deleted: true,
                linkId,
                message: result.message || "Link deleted successfully.",
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
