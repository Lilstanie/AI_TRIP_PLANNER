import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../app/styles/forms.css"), "utf8");

const genericButtonSelectors = () =>
  [...css.matchAll(/(^|\})\s*([^{}@]*?)\s*\{/g)]
    .map((match) => match[2]!.trim())
    .filter((selector) => /^button\b/.test(selector) && selector.includes(":not("));

describe("generic button rule in forms.css", () => {
  it("has a generic button rule to check", () => {
    expect(genericButtonSelectors().length).toBeGreaterThan(0);
  });

  it("keeps its exclusions inside :where() so component button rules win", () => {
    for (const selector of genericButtonSelectors())
      expect(selector.replace(/\s+/g, "")).toMatch(/^button:where\(:not\([^()]*\)\)$/);
  });
});
