#!/usr/bin/env node
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { SCREENS, walk } from "../../../../apps/web/tests/e2e/support/ui-tour.mjs";

const usage = (message) => {
  console.error(
    `${message}\nusage: node .agents/skills/ui-verification/scripts/tour.mjs [--base <url>] [--name <label>] [--views desktop,phone] [--langs zh,en] [--dark]`,
  );
  process.exit(2);
};

const options = {
  base: process.env.BASE_URL ?? "http://localhost:3000",
  name: "latest",
  views: "desktop,phone",
  langs: "zh,en",
  dark: false,
};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  const key = args[i].replace(/^--/, "");
  if (args[i] === "--dark") options.dark = true;
  else if (["base", "name", "views", "langs"].includes(key) && args[i].startsWith("--")) {
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) usage(`${args[i]} needs a value`);
    options[key] = value;
    i += 1;
  } else usage(`unknown argument: ${args[i]}`);
}
const views = options.views.split(",");
const langs = options.langs.split(",");
if (views.some((view) => !SCREENS[view])) usage(`--views takes desktop and/or phone`);
if (langs.some((lang) => !["zh", "en"].includes(lang))) usage(`--langs takes zh and/or en`);
if (!/^[\w.-]+$/.test(options.name))
  usage(`--name may only hold letters, digits, dot, dash and underscore`);

const up = await fetch(options.base).then(
  (response) => response.ok,
  () => false,
);
if (!up) {
  console.error(
    `no app at ${options.base}; start one with: cd apps/web && MOCK_PLACES=multi setsid nohup pnpm dev > /tmp/dev.log 2>&1 &`,
  );
  process.exit(1);
}

const modulePath = process.env.PLAYWRIGHT ?? "playwright";
let chromium;
try {
  ({ chromium } = createRequire(resolve("apps/web/package.json"))(modulePath));
} catch (error) {
  console.error(`cannot load Playwright from "${modulePath}": ${error.message}`);
  process.exit(1);
}

const outDir = join("output", "playwright", "tour", options.name);
rmSync(outDir, { recursive: true, force: true });
const browser = await chromium.launch();
const problems = [];
let saved = 0;
try {
  for (const appearance of options.dark ? ["light", "dark"] : ["light"])
    for (const language of langs)
      for (const view of views) {
        const dir = join(outDir, `${view}-${language}-${appearance}`);
        mkdirSync(dir, { recursive: true });
        const { missed, errors } = await walk(
          browser,
          { view, language, appearance, baseUrl: options.base },
          async (page, screen) => {
            await page.screenshot({ path: join(dir, `${screen.id}.png`) });
            saved += 1;
          },
        );
        for (const item of missed)
          problems.push(`${view}-${language}-${appearance}/${item.id}: ${item.error}`);
        for (const error of errors)
          console.log(`[${view}-${language}-${appearance}] page error: ${error}`);
      }
} finally {
  await browser.close();
}
console.log(`saved ${saved} screenshots under ${outDir}`);
for (const problem of problems) console.log(`FAIL ${problem}`);
process.exit(problems.length === 0 ? 0 : 1);
