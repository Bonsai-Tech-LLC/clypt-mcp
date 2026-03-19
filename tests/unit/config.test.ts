import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws if CLYPT_API_KEY is not set", () => {
    delete process.env.CLYPT_API_KEY;
    expect(() => loadConfig()).toThrow("CLYPT_API_KEY");
  });

  it("returns config with api key and default base URL", () => {
    process.env.CLYPT_API_KEY = "clypt_test123";
    const config = loadConfig();
    expect(config.apiKey).toBe("clypt_test123");
    expect(config.baseUrl).toBe("https://clypt.io");
  });

  it("uses custom base URL from env", () => {
    process.env.CLYPT_API_KEY = "clypt_test123";
    process.env.CLYPT_BASE_URL = "https://staging.clypt.io";
    const config = loadConfig();
    expect(config.baseUrl).toBe("https://staging.clypt.io");
  });

  it("strips trailing slashes from base URL", () => {
    process.env.CLYPT_API_KEY = "clypt_test123";
    process.env.CLYPT_BASE_URL = "https://clypt.io///";
    const config = loadConfig();
    expect(config.baseUrl).toBe("https://clypt.io");
  });
});
