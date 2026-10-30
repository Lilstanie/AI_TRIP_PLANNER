#!/usr/bin/env node
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

function usage(message) {
  console.error(
    `${message}\nusage: node .agents/skills/ui-verification/scripts/snap.mjs <url> [--selector <css>] [--name <label>] [--dark]`,
  );
  process.exit(2);
}

const options = { url: undefined, selector: undefined, name: "latest", dark: false };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--dark") options.dark = true;
  else if (arg === "--selector" || arg === "--name") {
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) usage(`${arg} needs a value`);
    options[arg.slice(2)] = value;
    i += 1;
  } else if (arg.startsWith("--")) usage(`unknown argument: ${arg}`);
  else if (options.url) usage(`unexpected argument: ${arg}`);
  else options.url = arg;
}
if (!options.url) usage("a URL is required");
if (!/^[\w.-]+$/.test(options.name))
  usage(`--name may only hold letters, digits, dot, dash and underscore`);

const modulePath = process.env.PLAYWRIGHT ?? "playwright";
let chromium;
try {
  ({ chromium } = createRequire(resolve("apps/web/package.json"))(modulePath));
} catch (error) {
  console.error(`cannot load Playwright from "${modulePath}": ${error.message}`);
  process.exit(1);
}

const views = [
  { label: "desktop", width: 1440, height: 1000, colorScheme: "light" },
  { label: "phone", width: 390, height: 844, colorScheme: "light", isMobile: true, hasTouch: true },
];
if (options.dark) {
  for (const view of [...views])
    views.push({ ...view, label: `${view.label}-dark`, colorScheme: "dark" });
}

const outDir = join("output", "playwright", "snap", options.name);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const problems = [];
const saved = [];
try {
  for (const view of views) {
    const { label, width, height, ...contextOptions } = view;
    const context = await browser.newContext({ viewport: { width, height }, ...contextOptions });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.log(`[${label}] page error: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") console.log(`[${label}] console error: ${message.text()}`);
    });
    const response = await page
      .goto(options.url, { waitUntil: "networkidle" })
      .catch((error) => error);
    if (response instanceof Error || !response || response.status() >= 400) {
      const status =
        response instanceof Error
          ? response.message.split("\n")[0]
          : (response?.status() ?? "no response");
      problems.push(`${label}: page did not load (${status})`);
      await context.close();
      continue;
    }
    const file = join(outDir, `${label}.png`);
    if (options.selector) {
      const target = page.locator(options.selector).first();
      if ((await target.count()) === 0) {
        problems.push(`${label}: selector ${options.selector} matched nothing`);
        await context.close();
        continue;
      }
      await target.screenshot({ path: file });
    } else {
      await page.screenshot({ path: file, fullPage: true });
    }
    saved.push(file);
    if (view.isMobile) {
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      if (scrollWidth > width)
        problems.push(`${label}: horizontal scroll (scrollWidth ${scrollWidth} > ${width})`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}

for (const file of saved) console.log(`saved ${file}`);
for (const problem of problems) console.log(`FAIL ${problem}`);
process.exit(problems.length === 0 ? 0 : 1);
