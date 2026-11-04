import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const e2eDir = resolve(__dirname, "../e2e");

const scripts = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? scripts(join(dir, entry.name))
      : entry.name.endsWith(".mjs")
        ? [join(dir, entry.name)]
        : [],
  );

const BARE_WAIT =
  /(?:locator\(\s*["'`]\.workspace-app["'`]\s*\)\s*\.waitFor|waitForSelector\(\s*["'`]\.workspace-app["'`])/g;

describe("E2E waits for the workspace", () => {
  it("never waits on .workspace-app alone, which also matches the loading skeleton", () => {
    const offenders = scripts(e2eDir).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(BARE_WAIT)].map(
        (match) => `${file.slice(e2eDir.length + 1)}: ${match[0]}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
