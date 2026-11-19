import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { VERSION } from "../../src/version.js";

function readJson(file: string) {
  return JSON.parse(readFileSync(resolve(__dirname, "../..", file), "utf8"));
}

// The MCP Registry reads server.json, npm reads package.json, and the server
// reports VERSION: all three must name the same release.
describe("VERSION", () => {
  it("matches package.json", () => {
    expect(VERSION).toBe(readJson("package.json").version);
  });

  it("matches both versions in server.json", () => {
    const serverJson = readJson("server.json");
    expect(serverJson.version).toBe(VERSION);
    expect(
      serverJson.packages.map((pkg: { version: string }) => pkg.version)
    ).toEqual([VERSION]);
  });
});
