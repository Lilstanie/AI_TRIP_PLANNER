// Tests derived from the failure inventory in verify-e2e-selectors.mjs, on small fixture folders.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { classesIn, missingSelectors } from "./verify-e2e-selectors.mjs";

function fixture(scripts, sources) {
  const root = mkdtempSync(join(tmpdir(), "e2e-selectors-"));
  for (const [dir, files] of [
    ["e2e", scripts],
    ["src", sources],
  ]) {
    mkdirSync(join(root, dir));
    for (const [name, text] of Object.entries(files)) writeFileSync(join(root, dir, name), text);
  }
  return (allowed) =>
    missingSelectors(join(root, "e2e"), [join(root, "src")], allowed).map(
      ({ line, name }) => `${line}:${name}`,
    );
}

test("a removed class still targeted by a script is reported with its line", () => {
  const run = fixture(
    { "a.e2e.mjs": 'page.locator(".trip-panel");\npage.locator(".section__row .cost");\n' },
    { "Panel.tsx": '<div className="trip-panel"><span className="cost" /></div>' },
  );
  assert.deepEqual(run(), ["2:section__row"]);
});

test("a class built from a template string counts as defined", () => {
  const run = fixture(
    { "a.e2e.mjs": 'page.locator(".timeline-stop--booked, .day-3")' },
    { "Stop.tsx": "className={`timeline-stop--${kind} day-${n}`}" },
  );
  assert.deepEqual(run(), []);
});

test("a class set by a library is allowed only through ALLOWED", () => {
  const run = fixture({ "a.e2e.mjs": 'page.locator(".leaflet-popup")' }, { "Map.tsx": "" });
  assert.deepEqual(run(), ["1:leaflet-popup"]);
  assert.deepEqual(run(new Map([["leaflet-popup", "set by Leaflet"]])), []);
});

test("file names, URLs and method calls inside strings are not classes", () => {
  const found = classesIn(
    [
      'const OUT = "output/summary.json";',
      'await page.goto("http://localhost:3000/trips");',
      "console.log(`${id.padEnd(20)}${`${n}/${m}`.padEnd(8)}`);",
      'writeFileSync(`${OUT}/01-shot.png`, "");',
    ].join("\n"),
  );
  assert.deepEqual(found, []);
});

test("a class mentioned only in a comment is not checked", () => {
  const found = classesIn(
    ['// the old ".section__row" is gone', ' * see ".day-strip"', 'x = 1; // ".gone"'].join("\n"),
  );
  assert.deepEqual(found, []);
});

test("a line that checks a class is gone is skipped; other uses are still checked", () => {
  const run = fixture(
    {
      "a.e2e.mjs":
        'check((await page.locator(".section__row").count()) === 0); // e2e-selectors: absent\npage.locator(".section__row").click();\n',
    },
    { "Panel.tsx": "" },
  );
  assert.deepEqual(run(), ["2:section__row"]);
});

test("a class that moved to another source file is still found", () => {
  const run = fixture(
    { "a.e2e.mjs": 'page.locator(".item-editor__actions")' },
    { "Old.tsx": "", "New.tsx": '<div className="item-editor__actions" />' },
  );
  assert.deepEqual(run(), []);
});

test("a stylesheet rule alone does not define a class", () => {
  const run = fixture(
    { "a.e2e.mjs": 'page.locator(".section__row")' },
    { "trip.css": ".section__row { display: grid; }" },
  );
  assert.deepEqual(run(), ["1:section__row"]);
});

test("a class name that is a prefix of a defined class is not taken as defined", () => {
  const run = fixture(
    { "a.e2e.mjs": 'page.locator(".trip")' },
    { "Panel.tsx": '<div className="trip-panel" />' },
  );
  assert.deepEqual(run(), ["1:trip"]);
});
