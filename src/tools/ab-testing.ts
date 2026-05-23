import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";

export function registerAbTesting(server: McpServer, client: ClyptClient) {
  // Create A/B Test
  server.tool(
    "create_ab_test",
    "Create an A/B test on a link. Split traffic across 2–5 URL variants with configurable weights. Same visitor always sees the same variant (cookie-based sticky bucketing). Edge-speed redirects (<50ms). Requires Pro plan or above.",
    {
      linkId: z.string().describe("The link ID to run the A/B test on"),
      variants: z
        .array(
          z.object({
            url: z.string().url().describe("Destination URL for this variant"),
            label: z
              .string()
              .optional()
              .describe("Label (e.g., 'Control', 'Variant A')"),
            weight: z
              .number()
              .min(1)
              .max(99)
              .describe("Traffic percentage (all weights must sum to 100)"),
          })
        )
        .min(2)
        .max(5)
        .describe("Array of 2–5 variants with URLs and traffic weights summing to 100"),
    },
    async ({ linkId, variants }) => {
      const result = await client.createAbTest(linkId, variants);
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

  // Get A/B Test Results
  server.tool(
    "get_ab_test_results",
    "Get A/B test results for a link, including click counts per variant, statistical significance (chi-square), confidence level, and recommendation on whether a winner can be declared.",
    {
      linkId: z.string().describe("The link ID to get A/B test results for"),
    },
    async ({ linkId }) => {
      const result = await client.getAbTestResults(linkId);
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

  // End A/B Test
  server.tool(
    "end_ab_test",
    "End an active A/B test. The link reverts to its original destination URL. Historical test data is preserved.",
    {
      linkId: z.string().describe("The link ID to end the A/B test for"),
    },
    async ({ linkId }) => {
      const result = await client.endAbTest(linkId);
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

  // Promote Winner
  server.tool(
    "promote_ab_test_winner",
    "Promote a winning A/B test variant. Sets the link's destination to the winner's URL and ends the test.",
    {
      linkId: z.string().describe("The link ID"),
      variantId: z
        .string()
        .describe("The variant ID to promote as the winner"),
    },
    async ({ linkId, variantId }) => {
      const result = await client.promoteAbTestWinner(linkId, variantId);
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
