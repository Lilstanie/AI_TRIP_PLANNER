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

const selectedRules = () =>
  cssFiles(stylesDir).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((match) => /\[aria-(pressed|selected)="true"\]/.test(match[1]!))
      .map((match) => ({
        file: file.slice(stylesDir.length + 1),
        selector: match[1]!.trim(),
        body: match[2]!,
      })),
  );

describe("selected segment fill", () => {
  it("finds selected-state rules to check", () => {
    expect(selectedRules().length).toBeGreaterThan(0);
  });

  it("uses --segment-thumb, not --surface, so the selected segment shows on dark tracks", () => {
    const offenders = selectedRules()
      .filter((rule) => /background(-color)?:\s*var\(--surface\)/.test(rule.body))
      .map((rule) => `${rule.file}: ${rule.selector}`);
    expect(offenders).toEqual([]);
  });

  it("does not invert a selected chip to the text colour, which glares as a white pill in dark mode", () => {
    const offenders = selectedRules()
      .filter((rule) => !/::(after|before)/.test(rule.selector))
      .filter((rule) => /background(-color)?:\s*var\(--text\)/.test(rule.body))
      .map((rule) => `${rule.file}: ${rule.selector}`);
    expect(offenders).toEqual([]);
  });
});
