// End-to-end walk through the Liquid Glass workspace: every major surface and transition, in
// light and dark, at desktop and phone widths. It leaves screenshots and a desktop video under
// output/playwright/liquid-glass/ as a repeatable artifact, and fails on console errors or a
// horizontal page scroll.
//
//   pnpm --filter @trip/web dev            # in another terminal
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/liquid-glass.e2e.mjs
//
// PLAYWRIGHT defaults to the `playwright` package resolvable from here.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/liquid-glass");
mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

async function open(browser, { width, height, scheme, video }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
    deviceScaleFactor: 2,
    ...(video ? { recordVideo: { dir: OUT, size: { width, height } } } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  // Mock data: no provider requests and a deterministic plan.
  const live = page.getByRole("button", { name: /Live data/ });
  if (await live.count()) await live.click();
  return { context, page, errors };
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const settle = (page, ms = 600) => page.waitForTimeout(ms);
const noSideScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function desktop(browser, scheme) {
  const { context, page, errors } = await open(browser, {
    width: 1440,
    height: 900,
    scheme,
    video: scheme === "light",
  });
  const tag = `desktop-${scheme}`;
  await settle(page);
  await shot(page, `${tag}-01-blank`);
  check(
    await page.evaluate(() => getComputedStyle(document.querySelector(".workspace-sidebar")).backdropFilter.includes("blur")),
    `${tag}: sidebar is glass`,
  );

  await page.getByRole("button", { name: /^Chats/ }).click();
  await settle(page, 500);
  await shot(page, `${tag}-02-chats-panel`);
  await page.keyboard.press("Escape");
  await settle(page, 400);

  await page.getByRole("button", { name: /^When|^Dates:/ }).click();
  await settle(page, 500);
  await shot(page, `${tag}-03-when-sheet`);
  await page.keyboard.press("Escape");
  await settle(page, 300);
  check(!(await page.getByRole("dialog", { name: "When" }).count()), `${tag}: When sheet closes`);

  await page.getByRole("button", { name: "Budget" }).first().click();
  await settle(page, 500);
  await shot(page, `${tag}-04-budget-sheet`);
  await page.keyboard.press("Escape");
  await settle(page, 300);

  await page.getByRole("button", { name: /^Trips/ }).click();
  await settle(page, 700);
  await shot(page, `${tag}-05-your-trips`);
  const calendar = page.getByRole("tab", { name: "Calendar" });
  await calendar.click();
  await settle(page, 500);
  check(
    (await page.locator(".trips-page__tabs").getAttribute("data-segmented")) === "ready",
    `${tag}: segmented thumb is placed`,
  );
  await shot(page, `${tag}-06-calendar`);

  // Back to a chat and plan an example trip.
  await page.getByRole("button", { name: /^Chats/ }).click();
  await settle(page, 400);
  await page.getByRole("button", { name: "New chat" }).first().click();
  await settle(page, 700);
  await page.locator(".chat-empty__suggestions button").first().click();
  await page
    .locator(".msg-item--agent .msg-item__body")
    .first()
    .waitFor({ timeout: 120_000 })
    .catch(() => undefined);
  await settle(page, 2500);
  await shot(page, `${tag}-07-planned`);

  await page.getByRole("button", { name: "Open your trip" }).click();
  await settle(page, 700);
  await shot(page, `${tag}-08-trip-drawer`);
  const timeline = page.getByRole("tab", { name: /Timeline/ });
  if (await timeline.count()) {
    await timeline.click();
    await settle(page, 600);
    await shot(page, `${tag}-09-trip-timeline`);
  }
  await page.keyboard.press("Escape");
  await settle(page, 500);
  check(!(await page.locator(".workspace-drawer-backdrop").count()), `${tag}: backdrop leaves after its fade`);

  check(await noSideScroll(page), `${tag}: no horizontal page scroll`);
  check(!errors.length, `${tag}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await context.close();
}

async function phone(browser, scheme) {
  const { context, page, errors } = await open(browser, { width: 390, height: 844, scheme });
  const tag = `phone-${scheme}`;
  await settle(page);
  await shot(page, `${tag}-01-chat`);
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await settle(page, 600);
  await shot(page, `${tag}-02-map`);
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await settle(page, 400);
  await page.getByRole("button", { name: /^Who|^Travellers:/ }).click();
  await settle(page, 600);
  await shot(page, `${tag}-03-who-sheet`);
  await page.keyboard.press("Escape");
  await settle(page, 400);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await settle(page, 600);
  await shot(page, `${tag}-04-navigation`);
  check(await noSideScroll(page), `${tag}: no horizontal page scroll`);
  check(!errors.length, `${tag}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await context.close();
}

// CHANNEL=chrome uses the installed Google Chrome instead of a downloaded Playwright build.
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
try {
  for (const scheme of ["light", "dark"]) {
    await desktop(browser, scheme);
    await phone(browser, scheme);
  }
} finally {
  await browser.close();
}
console.log(`\nArtifacts: ${OUT}`);
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
