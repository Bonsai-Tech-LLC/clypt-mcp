export interface ClyptConfig {
  apiKey: string;
  baseUrl: string;
}

export function loadConfig(): ClyptConfig {
  const apiKey = process.env.CLYPT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CLYPT_API_KEY environment variable is required. " +
        "Get your API key at https://clypt.io/dashboard/settings"
    );
  }

  const baseUrl = (
    process.env.CLYPT_BASE_URL || "https://clypt.io"
  ).replace(/\/+$/, "");

  return { apiKey, baseUrl };
}
