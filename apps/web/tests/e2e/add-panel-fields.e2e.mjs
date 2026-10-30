import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/add-panel-fields",
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

const fields = (page) =>
  page.locator(".add-panel").evaluate((panel) => {
    const read = (node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return {
        name: node.getAttribute("aria-label") ?? node.closest("label")?.innerText.trim() ?? "",
        type: node.type,
        height: Math.round(box.height),
        borderWidth: style.borderTopWidth,
        borderStyle: style.borderTopStyle,
        borderColor: style.borderTopColor,
        radius: style.borderTopLeftRadius,
        background: style.backgroundColor,
      };
    };
    const search = panel.querySelector("form[role=search] button");
    return {
      inputs: [...panel.querySelectorAll("input")].map(read),
      button: search ? Math.round(search.getBoundingClientRect().height) : null,
    };
  });
const visible = (field) => field.borderStyle !== "none" && parseFloat(field.borderWidth) >= 1;

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
    await page.locator(".add-panel").evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(300);

    const search = await fields(page);
    await page.locator(".add-panel").screenshot({ path: resolve(out, `${tag}-search.png`) });
    const box = search.inputs.find((field) => field.type === "search");
    check(box && visible(box), `${tag}: the search box has a visible border`, box);
    check(
      box && search.button && Math.abs(box.height - search.button) <= 1,
      `${tag}: the search box is as tall as the Search button`,
      { box: box?.height, button: search.button },
    );

    await page.getByRole("tab", { name: "Custom" }).click();
    await page.locator(".add-panel").evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(300);
    const custom = await fields(page);
    await page.locator(".add-panel").screenshot({ path: resolve(out, `${tag}-custom.png`) });
    const typed = custom.inputs.filter((field) => field.type !== "checkbox");
    check(
      typed.length === 3,
      `${tag}: Custom shows Name, Start time and Note`,
      typed.map((f) => f.name),
    );
    for (const field of typed) {
      check(visible(field), `${tag}: ${field.name} has a visible border`, field);
    }
    const look = (field) => `${field.borderColor}|${field.radius}|${field.height}`;
    check(
      typed.every((field) => look(field) === look(typed[0])),
      `${tag}: Custom fields share one border, corner and height`,
      typed.map(look),
    );
    check(
      [box, ...typed].every((field) => field && field.radius === typed[0].radius),
      `${tag}: the search box uses the same corner as the Custom fields`,
      [box?.radius, typed[0]?.radius],
    );
    const keep = custom.inputs.find((field) => field.type === "checkbox");
    check(keep && keep.height <= 24, `${tag}: Keep open stays a checkbox`, keep);
    results[tag] = { search, custom };
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
