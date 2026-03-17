import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";

export function registerAiQrCode(server: McpServer, client: ClyptClient) {
  // Generate AI Artistic QR Code
  server.tool(
    "generate_ai_qr_code",
    "Generate an AI artistic QR code for a link. The QR code is embedded into AI-generated artwork using a style preset or custom prompt. Takes ~35 seconds. Returns a generation ID to poll for completion. Requires Pro plan. Styles: watercolor, oil-painting, cyberpunk, minimal, japanese, nature, abstract, geometric.",
    {
      linkId: z.string().describe("The link ID to generate an AI QR code for"),
      style: z
        .enum([
          "watercolor",
          "oil-painting",
          "cyberpunk",
          "minimal",
          "japanese",
          "nature",
          "abstract",
          "geometric",
        ])
        .optional()
        .describe("Style preset for the artwork"),
      prompt: z
        .string()
        .optional()
        .describe(
          "Custom prompt describing the desired artwork (e.g., 'mountain landscape at sunset'). Can be used alone or combined with a style preset."
        ),
      seed: z
        .number()
        .optional()
        .describe(
          "Random seed for reproducible results. Same seed + same prompt = same image."
        ),
    },
    async ({ linkId, style, prompt, seed }) => {
      if (!style && !prompt) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Either 'style' or 'prompt' (or both) must be provided.",
            },
          ],
        };
      }

      const result = await client.generateAiQr({
        linkId,
        style,
        prompt,
        seed,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...result,
                note: "Generation takes ~35 seconds. Use get_ai_qr_status to poll for completion.",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Poll AI QR Status
  server.tool(
    "get_ai_qr_status",
    "Check the status of an AI QR code generation. Returns 'generating', 'ready' (with imageUrl), or 'failed'. Poll every 5–10 seconds until ready.",
    {
      id: z.string().describe("The AI QR code generation ID"),
    },
    async ({ id }) => {
      const result = await client.getAiQrStatus(id);
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

  // List AI QR Styles
  server.tool(
    "list_ai_qr_styles",
    "List all available AI QR code style presets.",
    {},
    async () => {
      const result = await client.listAiQrStyles();
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
