import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/chat-trip-title",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PROMPT = "Plan 4 days in Lisbon from Sydney, 2 people, budget 6000 AUD, from 2027-03-10";
const FOLLOW = "Add a fado night";
const browser = await chromium.launch({ channel: process.env.CHANNEL });

const heading = (page) => page.locator("h1.chat-header__heading").first().innerText();
const replies = (page) => page.locator(".msg-item--agent .msg-item__clock");

async function send(page, text) {
  const before = await replies(page).count();
  const box = page.locator(".chat .composer textarea, .trip-home__composer textarea").first();
  await box.fill(text);
  await box.press("Enter");
  await page.waitForFunction(
    (count) => document.querySelectorAll(".msg-item--agent .msg-item__clock").length > count,
    before,
    { timeout: 90_000 },
  );
}

const journeys = [
  { tag: "en", language: "en", trip: "Trip to Lisbon", chats: "Chats" },
  { tag: "zh", language: "zh", trip: "Trip to Lisbon", chats: "聊天" },
];
const results = {};
try {
  for (const journey of journeys) {
    const { tag } = journey;
    const context = await browser.newContext({
      locale: journey.language === "zh" ? "zh-CN" : "en-AU",
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript((language) => {
      if (localStorage.getItem("chat-trip-title-seed")) return;
      localStorage.setItem("chat-trip-title-seed", "1");
      localStorage.setItem("trip.settings.v1", JSON.stringify({ language }));
    }, journey.language);
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await send(page, PROMPT);
    await page.waitForTimeout(600);
    const planned = await heading(page);
    await page.screenshot({ path: resolve(out, `${tag}-planned.png`) });
    results[tag] = { planned };
    check(/^Lisbon · /.test(planned), `${tag}: the planned chat is named after the trip`, planned);
    check(
      !planned.includes("Plan 4 days"),
      `${tag}: the title does not repeat the prompt`,
      planned,
    );
    check(
      journey.language === "zh" ? /月/.test(planned) : /Mar/.test(planned),
      `${tag}: the title's dates follow the interface language`,
      planned,
    );
    check(
      (await page.title()).startsWith(planned.split(" · ")[0]),
      `${tag}: the browser title still names the trip`,
      await page.title(),
    );

    await page
      .locator(".sidebar-nav")
      .getByRole("button", { name: new RegExp(`^${journey.chats}`) })
      .click();
    await page.waitForTimeout(600);
    const listed = await page.locator(".chats-panel").innerText();
    check(listed.includes(planned), `${tag}: the Chats list shows the trip name`, planned);
    check(
      !listed.includes("Plan 4 days in Lisbon"),
      `${tag}: the Chats list does not show the prompt`,
    );
    await page.screenshot({ path: resolve(out, `${tag}-chats.png`) });

    if (journey.language === "en") {
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Trips/ })
        .click();
      await page
        .locator(".trip-cards .trip-card")
        .filter({ hasText: journey.trip })
        .first()
        .click();
      await page.locator(".trip-home").waitFor();
      await send(page, FOLLOW);
      await page.waitForTimeout(600);
      const second = await heading(page);
      results[tag].second = second;
      check(
        second === FOLLOW,
        `${tag}: a later chat in the same trip keeps its first message`,
        second,
      );
      await page.getByRole("button", { name: "View trip", exact: true }).first().click();
      await page.locator(".trip-home-chats").waitFor();
      const rows = await page.locator(".trip-home-chats__name").allInnerTexts();
      results[tag].rows = rows;
      await page.screenshot({ path: resolve(out, `${tag}-trip-home.png`) });
      check(
        rows.includes(planned) && rows.includes(FOLLOW) && new Set(rows).size === rows.length,
        `${tag}: Trip home lists the trip chat and the later chat under different names`,
        rows,
      );

      await page.locator(".trip-home-chats__row").filter({ hasText: planned }).click();
      await page.locator("h1.chat-header__heading").first().waitFor();
      const menu = page.locator(".chat-header button[aria-haspopup]").first();
      await menu.click();
      await page.getByRole("menuitem", { name: "Rename" }).click();
      const field = page.getByRole("dialog").locator("input").first();
      await field.fill("Lisbon with Sam");
      await field.press("Enter");
      await page.waitForTimeout(400);
      await send(page, "Make day 2 slower");
      await page.waitForTimeout(600);
      const renamed = await heading(page);
      check(
        renamed === "Lisbon with Sam",
        `${tag}: a renamed chat keeps its name after a new plan`,
        renamed,
      );
    }
    check(pageErrors.length === 0, `${tag}: no page errors`, pageErrors);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(
    resolve(out, "summary.json"),
    JSON.stringify({ base: BASE, checks, results }, null, 2),
  );
}
const failed = checks.filter((item) => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed; evidence in ${out}`);
if (failed.length) process.exit(1);
