import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClyptClient } from "./client.js";
import { ClyptConfig } from "./config.js";

export function registerResources(
  server: McpServer,
  client: ClyptClient,
  config: ClyptConfig
) {
  // Resource: API documentation overview
  server.resource(
    "api-docs",
    "clypt://api/docs",
    {
      description:
        "Clypt REST API documentation â endpoints, authentication, and rate limits",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "clypt://api/docs",
          mimeType: "text/markdown",
          text: `# Clypt API Documentation

## Base URL
\`${config.baseUrl}/api/v1\`

## Authentication
All requests require a Bearer token in the Authorization header:
\`\`\`
Authorization: Bearer clypt_your_api_key
\`\`\`

Get your API key at [${config.baseUrl}/dashboard/settings](${config.baseUrl}/dashboard/settings)

## Rate Limits
- **100 requests per minute** per API key
- 429 responses include a \`Retry-After\` header

## Endpoints

### Links
| Method | Path | Description |
|--------|------|-------------|
| POST | /links | Create a shortened link |
| GET | /links | List links (with search, tag filter, pagination) |
| GET | /links/:id | Get a single link |
| PATCH | /links/:id | Update a link |
| DELETE | /links/:id | Delete a link |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | /links/:id/analytics | Link click analytics (time-series, geo, device, referrer) |
| GET | /analytics | Dashboard stats (totals, top performers) |

### Tags
| Method | Path | Description |
|--------|------|-------------|
| POST | /tags | Create a tag |
| GET | /tags | List all tags |

### Folders
| Method | Path | Description |
|--------|------|-------------|
| POST | /folders | Create a folder |
| GET | /folders | List all folders |

### API Keys
| Method | Path | Description |
|--------|------|-------------|
| POST | /keys | Create an API key |
| GET | /keys | List API keys |

## Error Responses
All errors return JSON with \`error\` and optional \`message\` fields:
\`\`\`json
{
  "error": "Not found",
  "message": "Link not found"
}
\`\`\`

## Scopes
API keys can be scoped to specific permissions:
- \`links:read\` / \`links:write\`
- \`analytics:read\`
- \`tags:read\` / \`tags:write\`
- \`folders:read\` / \`folders:write\`
`,
        },
      ],
    })
  );

  // Resource: Account overview (dynamic)
  server.resource(
    "account-stats",
    "clypt://account/stats",
    {
      description: "Live account statistics â total links, clicks, and top performers",
      mimeType: "application/json",
    },
    async () => {
      try {
        const stats = await client.getDashboardStats();
        return {
          contents: [
            {
              uri: "clypt://account/stats",
              mimeType: "application/json",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          contents: [
            {
              uri: "clypt://account/stats",
              mimeType: "application/json",
              text: JSON.stringify(
                { error: "Failed to fetch stats", message: error.message },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  // Resource: Recent links (dynamic)
  server.resource(
    "recent-links",
    "clypt://links/recent",
    {
      description: "Your 20 most recently created links",
      mimeType: "application/json",
    },
    async () => {
      try {
        const result = await client.listLinks({ limit: 20 });
        return {
          contents: [
            {
              uri: "clypt://links/recent",
              mimeType: "application/json",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          contents: [
            {
              uri: "clypt://links/recent",
              mimeType: "application/json",
              text: JSON.stringify(
                { error: "Failed to fetch links", message: error.message },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  // Resource: Tags list (dynamic)
  server.resource(
    "tags",
    "clypt://tags",
    {
      description: "All tags in your Clypt account",
      mimeType: "application/json",
    },
    async () => {
      try {
        const result = await client.listTags();
        return {
          contents: [
            {
              uri: "clypt://tags",
              mimeType: "application/json",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          contents: [
            {
              uri: "clypt://tags",
              mimeType: "application/json",
              text: JSON.stringify(
                { error: "Failed to fetch tags", message: error.message },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  // Resource: Folders list (dynamic)
  server.resource(
    "folders",
    "clypt://folders",
    {
      description: "All folders in your Clypt account",
      mimeType: "application/json",
    },
    async () => {
      try {
        const result = await client.listFolders();
        return {
          contents: [
            {
              uri: "clypt://folders",
              mimeType: "application/json",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          contents: [
            {
              uri: "clypt://folders",
              mimeType: "application/json",
              text: JSON.stringify(
                { error: "Failed to fetch folders", message: error.message },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );
}
