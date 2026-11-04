import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { SCREENS, walk } from "./support/ui-tour.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/axe-scan", process.env.LABEL ?? "run");
const BLOCKING = new Set(["critical", "serious"]);
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const browser = await chromium.launch({ channel: process.env.CHANNEL });
const report = [];
try {
  for (const view of Object.keys(SCREENS))
    for (const appearance of ["light", "dark"]) {
      const { missed, errors } = await walk(
        browser,
        { view, language: "en", appearance, baseUrl: BASE },
        async (page, screen) => {
          await page.addScriptTag({ content: AXE });
          const violations = await page.evaluate(async () =>
            (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map(
              (violation) => ({
                id: violation.id,
                impact: violation.impact,
                targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
              }),
            ),
          );
          const blocking = violations.filter((violation) => BLOCKING.has(violation.impact));
          report.push({ view, appearance, screen: screen.id, violations });
          check(
            blocking.length === 0,
            `${view}-${appearance}/${screen.id}: no critical or serious axe violations`,
            blocking.length ? blocking : undefined,
          );
        },
      );
      check(missed.length === 0, `${view}-${appearance}: every screen opens`, missed);
      check(errors.length === 0, `${view}-${appearance}: no page errors`, errors);
    }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/violations.json`, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(`${OUT}/result.json`, `${JSON.stringify(results, null, 2)}\n`);
const failed = results.filter((result) => !result.ok);
console.log(
  `${results.length - failed.length}/${results.length} checks passed; evidence in ${OUT}`,
);
process.exitCode = failed.length ? 1 : 0;
