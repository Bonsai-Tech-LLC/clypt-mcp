import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClyptClient } from "../client.js";

export function registerGenerateQrCode(
  server: McpServer,
  client: ClyptClient
) {
  server.tool(
    "generate_qr_code",
    "Generate a QR code for any URL or an existing Clypt short link.",
    {
      url: z
        .string()
        .url()
        .describe("The URL to generate a QR code for (can be a Clypt short URL or any URL)"),
      size: z
        .number()
        .min(100)
        .max(1000)
        .optional()
        .describe("QR code size in pixels (default: 256)"),
      fgColor: z
        .string()
        .optional()
        .describe("Foreground color as hex (e.g., '#000000')"),
      bgColor: z
        .string()
        .optional()
        .describe("Background color as hex (e.g., '#ffffff')"),
    },
    async ({ url, size, fgColor, bgColor }) => {
      // Build the QR code URL using a public QR API
      // Clypt's QR page generates these client-side
      const qrSize = size || 256;
      const fg = (fgColor || "#000000").replace("#", "");
      const bg = (bgColor || "#ffffff").replace("#", "");

      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(url)}&color=${fg}&bgcolor=${bg}&format=png`;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                qrCodeUrl: qrApiUrl,
                targetUrl: url,
                size: qrSize,
                format: "png",
                note: "Open the qrCodeUrl to view or download the QR code image.",
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
