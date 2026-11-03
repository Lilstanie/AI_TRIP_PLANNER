import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesDir = resolve(__dirname, "../../app/styles");

const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? cssFiles(join(dir, entry.name))
      : entry.name.endsWith(".css")
        ? [join(dir, entry.name)]
        : [],
  );

const phoneEmptyMapRules = () =>
  cssFiles(stylesDir).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map((match) => match[1]!.trim())
      .filter((selector) => /\[data-phone\].*\.trip-map-canvas--empty/.test(selector)),
  );

describe("phone empty map placement", () => {
  it("moves the empty-map status to the top only on the Map tab, so the trip home card stays centred", () => {
    const rules = phoneEmptyMapRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const selector of rules) expect(selector).toContain(".workspace-panel--map");
  });
});
