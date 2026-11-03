import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { walk } from "./support/ui-tour.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/zh-latin-scan", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });

const ALLOWED = new Set([
  ...["AI", "AUD", "CNY", "USD", "JPY", "km", "m", "h", "min"],
  ...["OpenStreetMap", "OpenFreeMap", "Google", "Apple", "MapLibre"],
]);
const DATA_KEYS = new Set([
  "location",
  "from",
  "to",
  "name",
  "carrier",
  "area",
  "destination",
  "origin",
  "title",
  "airline",
  "flightNumber",
]);
const WORD = /[A-Za-z][A-Za-z'’&.-]*[A-Za-z]|[A-Za-z]/g;

const dataWords = (value, key, words) => {
  if (Array.isArray(value)) value.forEach((item) => dataWords(item, key, words));
  else if (value && typeof value === "object")
    Object.entries(value).forEach(([k, v]) => dataWords(v, k, words));
  else if (typeof value === "string" && DATA_KEYS.has(key))
    for (const word of value.match(WORD) ?? []) words.add(word);
  return words;
};

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const browser = await chromium.launch({ channel: process.env.CHANNEL });
const leaks = [];
try {
  for (const view of ["desktop", "phone"]) {
    const scanned = [];
    const { missed, errors } = await walk(
      browser,
      { view, language: "zh", appearance: "light", baseUrl: BASE },
      async (page, screen) => {
        check(
          await page.evaluate(() => document.documentElement.lang === "zh-CN"),
          `${view}/${screen.id} renders in Chinese`,
        );
        const stored = await page.evaluate(() =>
          Object.keys(localStorage)
            .filter((key) => key.startsWith("trip-workspace") || key.startsWith("trip.revision"))
            .map((key) => {
              try {
                return JSON.parse(localStorage.getItem(key));
              } catch {
                return null;
              }
            }),
        );
        const known = dataWords(stored, "", new Set(ALLOWED));
        const lines = await page.evaluate(() => {
          const texts = document.body.innerText.split("\n");
          for (const element of document.querySelectorAll("[placeholder], [aria-label]")) {
            const box = element.getBoundingClientRect();
            if (!box.width || !box.height || element.closest("nextjs-portal")) continue;
            texts.push(
              element.getAttribute("placeholder") ?? "",
              element.getAttribute("aria-label") ?? "",
            );
          }
          return texts.map((text) => text.trim()).filter(Boolean);
        });
        for (const line of new Set(lines))
          for (const word of line.replace(/°[CF]/g, "").match(WORD) ?? [])
            if (!known.has(word))
              leaks.push({ screen: `${view}/${screen.id}`, word, line: line.slice(0, 120) });
        await page.screenshot({ path: resolve(OUT, `${view}-${screen.id}.png`) });
        scanned.push(screen.id);
      },
    );
    check(missed.length === 0, `${view}: every screen opens`, missed);
    check(
      scanned.includes("chat-reply"),
      `${view}: the mock plan finished and trip screens were scanned`,
    );
    check(errors.length === 0, `${view}: no page errors`, errors);
  }
  const byScreen = Object.groupBy(leaks, (leak) => leak.screen);
  check(
    leaks.length === 0,
    "no English words outside trip data in the Chinese interface",
    Object.fromEntries(
      Object.entries(byScreen).map(([screen, items]) => [
        screen,
        [...new Map(items.map((item) => [item.line, item.line])).values()].slice(0, 15),
      ]),
    ),
  );
} finally {
  await browser.close();
  writeFileSync(
    resolve(OUT, "report.json"),
    JSON.stringify({ base: BASE, results, leaks }, null, 2),
  );
}
const failed = results.filter((item) => !item.ok);
console.log(
  `${results.length - failed.length}/${results.length} checks passed; evidence in ${OUT}`,
);
if (failed.length) process.exit(1);
