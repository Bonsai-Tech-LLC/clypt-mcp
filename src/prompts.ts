import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer) {
  // Prompt: Shorten a URL with context
  server.prompt(
    "shorten-url",
    "Shorten a URL with smart defaults â suggests tags, custom slug, and folder based on the URL content",
    { url: z.string().url().describe("The URL to shorten") },
    ({ url }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I want to shorten this URL using Clypt: ${url}

Please:
1. Analyze the URL to suggest a meaningful custom slug (short, memorable, lowercase with hyphens)
2. Suggest relevant tags based on the URL domain and path
3. Ask if I want to set an expiration date or password
4. Use the shorten_link tool to create the short link with the suggested options
5. Return the shortened URL and a summary`,
          },
        },
      ],
    })
  );

  // Prompt: Analytics report
  server.prompt(
    "analytics-report",
    "Generate a comprehensive analytics report for a link or your entire account",
    {
      linkId: z
        .string()
        .optional()
        .describe(
          "Specific link ID to analyze. Omit for account-wide report."
        ),
      period: z
        .enum(["7d", "30d", "90d", "all"])
        .optional()
        .describe("Time period (default: 30d)"),
    },
    ({ linkId, period }) => {
      const target = linkId
        ? `link ID "${linkId}"`
        : "my entire Clypt account";
      const timeframe = period || "30d";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Generate a detailed analytics report for ${target} over the last ${timeframe}.

Please:
1. ${linkId ? `Use get_link_analytics for link "${linkId}" with period "${timeframe}"` : `Use get_dashboard_stats to get account-wide metrics`}
2. Summarize the key metrics (total clicks, unique visitors, trends)
3. Highlight the top traffic sources, devices, and geographic regions
4. Identify any notable patterns or anomalies
5. Provide actionable recommendations to improve click-through rates
6. Format as a clean report with sections and bullet points`,
            },
          },
        ],
      };
    }
  );

  // Prompt: Bulk import
  server.prompt(
    "bulk-import",
    "Import and shorten multiple URLs at once from a list",
    {
      urls: z
        .string()
        .describe(
          "Newline-separated or comma-separated list of URLs to shorten"
        ),
      tag: z
        .string()
        .optional()
        .describe("Tag to apply to all imported links"),
      folderId: z
        .string()
        .optional()
        .describe("Folder to organize all imported links into"),
    },
    ({ urls, tag, folderId }) => {
      const urlList = urls
        .split(/[\n,]+/)
        .map((u) => u.trim())
        .filter(Boolean);

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I need to bulk-shorten these ${urlList.length} URLs using Clypt:

${urlList.map((u, i) => `${i + 1}. ${u}`).join("\n")}

${tag ? `Apply the tag "${tag}" to all links.` : ""}
${folderId ? `Put all links in folder "${folderId}".` : ""}

Please:
1. Use the bulk_shorten tool with the URLs array${tag ? `, tags: ["${tag}"]` : ""}${folderId ? `, folderId: "${folderId}"` : ""}
2. Show a summary table of original URL â short URL for each
3. Report any failures
4. Give the total count of successfully shortened links`,
            },
          },
        ],
      };
    }
  );

  // Prompt: Link cleanup
  server.prompt(
    "link-cleanup",
    "Review and clean up your links â find expired, broken, or low-performing links",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me clean up my Clypt links.

Please:
1. Use list_links to fetch my recent links (limit 100)
2. Use get_dashboard_stats for the overview
3. Identify links that:
   - Have zero clicks (never used)
   - Are expired or close to expiring
   - Have very low engagement compared to average
4. Suggest which links to delete, update, or keep
5. Ask for confirmation before deleting anything
6. Provide a summary of the cleanup actions taken`,
          },
        },
      ],
    })
  );

  // Prompt: Campaign setup
  server.prompt(
    "campaign-setup",
    "Set up a marketing campaign â create tagged, organized links with UTM parameters",
    {
      campaignName: z
        .string()
        .describe("Name of the marketing campaign"),
      urls: z
        .string()
        .describe(
          "Newline-separated URLs for the campaign"
        ),
    },
    ({ campaignName, urls }) => {
      const urlList = urls
        .split(/[\n,]+/)
        .map((u) => u.trim())
        .filter(Boolean);

      const slugPrefix = campaignName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Help me set up a marketing campaign called "${campaignName}" in Clypt.

URLs to shorten:
${urlList.map((u, i) => `${i + 1}. ${u}`).join("\n")}

Please:
1. Create a tag named "${campaignName}" using manage_tags
2. Create a folder named "${campaignName}" using manage_folders
3. Shorten each URL with:
   - Custom slug prefixed with "${slugPrefix}-" (e.g., "${slugPrefix}-landing", "${slugPrefix}-cta")
   - The "${campaignName}" tag
   - Placed in the "${campaignName}" folder
4. Present a summary table with all the short links
5. Suggest UTM parameters I should add to the original URLs for tracking`,
            },
          },
        ],
      };
    }
  );
}
