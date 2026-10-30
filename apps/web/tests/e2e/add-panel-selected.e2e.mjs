import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/add-panel-selected",
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
const browser = await chromium.launch({ channel: process.env.CHANNEL });

const chips = (page) =>
  page.locator(".add-panel").evaluate((panel) => {
    const read = (node) => {
      const style = getComputedStyle(node);
      return {
        text: node.innerText.trim(),
        on:
          node.getAttribute("aria-selected") === "true" ||
          node.getAttribute("aria-pressed") === "true",
        background: style.backgroundColor,
        color: style.color,
      };
    };
    return {
      tabs: [...panel.querySelectorAll('[role="tab"]')].map(read),
      filters: [...panel.querySelectorAll(".add-panel__filters button")].map(read),
      others: [...panel.querySelectorAll(".add-panel__close, form[role=search] button")].map(read),
    };
  });
const looks = (item) => `${item.background}|${item.color}`;
function verify(tag, group, items) {
  const selected = items.filter((item) => item.on);
  const rest = items.filter((item) => !item.on);
  check(
    selected.length === 1,
    `${tag}: exactly one ${group} is selected`,
    selected.map((i) => i.text),
  );
  check(
    selected.length === 1 && rest.every((item) => looks(item) !== looks(selected[0])),
    `${tag}: the selected ${group} looks different from the others`,
    { selected: selected[0], other: rest[0] },
  );
  return selected[0];
}

async function plan(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const box = page.locator("textarea").first();
  await box.fill(PROMPT);
  await box.press("Enter");
  await page.locator(".msg-item--agent .msg-item__clock").first().waitFor({ timeout: 90_000 });
}

const journeys = [
  { tag: "desktop", viewport: { width: 1440, height: 900 } },
  { tag: "dark", viewport: { width: 1440, height: 900 }, colorScheme: "dark" },
  { tag: "phone", viewport: { width: 390, height: 844 }, phone: true },
];
const results = {};
try {
  for (const journey of journeys) {
    const { tag } = journey;
    const context = await browser.newContext({
      locale: "en-AU",
      viewport: journey.viewport,
      ...(journey.colorScheme ? { colorScheme: journey.colorScheme } : {}),
      ...(journey.phone ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await plan(page);
    if (journey.phone) {
      await page.locator(".phone-tabbar").getByText("Mine").click();
      await page.getByText("Trip to Lisbon").first().click();
      await page.getByText("Itinerary", { exact: true }).first().click();
    } else {
      const tripButton = page.locator(".trip-trigger");
      if ((await tripButton.getAttribute("aria-expanded")) !== "true") await tripButton.click();
    }
    await page
      .getByRole("button", { name: /^Add to Day \d+$/ })
      .first()
      .click();
    await page.locator(".add-panel").waitFor();
    await page.waitForTimeout(300);

    const first = await chips(page);
    results[tag] = { first };
    await page.locator(".add-panel").screenshot({ path: resolve(out, `${tag}-search.png`) });
    const tab = verify(tag, "tab", first.tabs);
    check(tab?.text === "Search", `${tag}: Search is the opening tab`, tab?.text);
    const filter = verify(tag, "filter", first.filters);
    check(
      first.others.every((item) => looks(item) !== looks(tab ?? item)),
      `${tag}: Close and the search button do not look selected`,
      first.others,
    );

    await page.locator(".add-panel__filters button").nth(1).click();
    await page.waitForTimeout(300);
    const filtered = await chips(page);
    const moved = verify(`${tag} after Stays`, "filter", filtered.filters);
    check(
      moved?.text === "Stays" && moved.text !== filter?.text,
      `${tag}: choosing Stays moves the selection to it`,
      moved?.text,
    );

    await page.getByRole("tab", { name: "Custom" }).click();
    await page.waitForTimeout(300);
    const custom = await chips(page);
    results[tag].custom = custom;
    await page.locator(".add-panel").screenshot({ path: resolve(out, `${tag}-custom.png`) });
    const now = verify(`${tag} after Custom`, "tab", custom.tabs);
    check(now?.text === "Custom", `${tag}: choosing Custom moves the selection to it`, now?.text);
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
