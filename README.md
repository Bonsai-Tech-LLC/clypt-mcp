# Clypt MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that connects AI assistants to [Clypt](https://clypt.io) — the AI-Powered Link Intelligence platform. Shorten links, view analytics, manage tags and folders, all from Claude, ChatGPT, Cursor, or any MCP-compatible client.

## Quick Start

```bash
npx clypt-mcp
```

You'll need a Clypt API key. Get one at [clypt.io/dashboard/settings](https://clypt.io/dashboard/settings).

## Installation

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "clypt": {
      "command": "npx",
      "args": ["-y", "clypt-mcp"],
      "env": {
        "CLYPT_API_KEY": "clypt_your_key_here"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "clypt": {
      "command": "npx",
      "args": ["-y", "clypt-mcp"],
      "env": {
        "CLYPT_API_KEY": "clypt_your_key_here"
      }
    }
  }
}
```

### Global Install

```bash
npm install -g clypt-mcp
CLYPT_API_KEY=clypt_your_key_here clypt-mcp
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLYPT_API_KEY` | Yes | - | Your Clypt API key |
| `CLYPT_BASE_URL` | No | `https://clypt.io` | Custom API base URL |

## Available Tools

### `shorten_link`
Create a shortened Clypt link.
- `url` (required) — The URL to shorten
- `slug` — Custom short code
- `tags` — Tags to attach
- `expiresAt` — Expiration date (ISO 8601)
- `password` — Password protection
- `folderId` — Folder to organize into

### `list_links`
List your shortened links with search and filtering.
- `search` — Search by URL, title, or short code
- `tag` — Filter by tag
- `limit` — Results per page (max 100)
- `offset` — Pagination offset

### `get_link_analytics`
Get click analytics for a specific link.
- `linkId` (required) — Link ID or short code
- `period` — Time period: `7d`, `30d`, `90d`, or `all`

### `get_dashboard_stats`
Get high-level dashboard statistics (total links, clicks, top performers). No parameters required.

### `generate_qr_code`
Generate a QR code for any URL.
- `url` (required) — URL to encode
- `size` — Size in pixels (100-1000)
- `fgColor` — Foreground hex color
- `bgColor` — Background hex color

### `manage_tags`
Create or list tags.
- `action` (required) — `create` or `list`
- `name` — Tag name (for create)
- `color` — Tag color hex (for create)

### `manage_folders`
Create or list folders.
- `action` (required) — `create` or `list`
- `name` — Folder name (for create)
- `parentId` — Parent folder ID (for create)

### `bulk_shorten`
Shorten multiple URLs at once (max 25).
- `urls` (required) — Array of URLs
- `tags` — Tags for all links
- `folderId` — Folder for all links

### `delete_link`
Delete a link by ID.
- `linkId` (required) — Link ID to delete

### `create_ab_test`
Create an A/B split test on a link (Pro plan or above).
- `linkId` (required) — The link ID to test
- `variants` (required) — Array of 2–5 variants, each with `url`, optional `label`, and `weight` (weights must sum to 100)

### `get_ab_test_results`
Get A/B test results including per-variant clicks, statistical significance (chi-square), and winner recommendation.
- `linkId` (required) — The link ID

### `end_ab_test`
End an active A/B test. The link reverts to its original URL. Test data is preserved.
- `linkId` (required) — The link ID

### `promote_ab_test_winner`
Promote a winning variant as the sole destination URL and end the test.
- `linkId` (required) — The link ID
- `variantId` (required) — The variant ID to promote

### `generate_ai_qr_code`
Generate an AI artistic QR code using Stable Diffusion + ControlNet (Pro plan or above).
- `linkId` (required) — The link ID to generate for
- `prompt` — Text prompt describing the desired art style
- `style` — Preset style: `watercolor`, `oil_painting`, `cyberpunk`, `minimal`, `japanese`, `nature`, `abstract`, `geometric`

## Example Usage

Once configured, you can ask your AI assistant things like:

> "Shorten https://example.com/my-long-article-url with the tag 'marketing'"

> "Show me analytics for my top links this month"

> "Create a QR code for clypt.io/abc123"

> "List all my links tagged 'campaign-q1'"

> "Bulk shorten these 5 URLs for our newsletter"

> "Set up a 50/50 A/B test on my landing page link with the new design vs the old one"

> "Check the A/B test results — is there a winner yet?"

> "Promote the winning variant and end the test"

## Development

```bash
git clone https://github.com/Bonsai-Tech-LLC/clypt-mcp.git
cd clypt-mcp
npm install
npm run build
CLYPT_API_KEY=your_key node dist/index.js
```

## License

MIT - See [LICENSE](LICENSE) for details.

## Links

- [Clypt](https://clypt.io) — AI-Powered Link Intelligence
- [Clypt API Docs](https://clypt.io/api/v1/docs)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Report Issues](https://github.com/Bonsai-Tech-LLC/clypt-mcp/issues)
