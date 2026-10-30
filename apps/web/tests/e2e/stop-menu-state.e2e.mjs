import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/stop-menu-state",
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

const readMenu = (page) =>
  page.locator(".action-menu__list").evaluate((list) =>
    [...list.querySelectorAll("button")].map((item) => ({
      label: item.innerText.trim(),
      role: item.getAttribute("role"),
      checked: item.getAttribute("aria-checked"),
      disabled: item.disabled,
      danger: item.classList.contains("is-danger"),
      icon: item.querySelector(".action-menu__icon svg")?.innerHTML ?? "",
      height: Math.round(item.getBoundingClientRect().height),
    })),
  );

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
  { tag: "phone", viewport: { width: 390, height: 844 }, phone: true },
];
const results = {};
try {
  for (const journey of journeys) {
    const { tag } = journey;
    const context = await browser.newContext({
      locale: "en-AU",
      viewport: journey.viewport,
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
    const trigger = page.locator(".timeline-stop .action-menu__trigger").first();
    const openMenu = async () => {
      await trigger.click();
      await page.locator(".action-menu__list").waitFor();
      await page.waitForTimeout(250);
      return readMenu(page);
    };
    const choose = async (name) => {
      await page.locator(".action-menu__list button", { hasText: new RegExp(`^${name}$`) }).click();
      await page.waitForTimeout(400);
    };

    const first = await openMenu();
    results[tag] = { first };
    await page.locator(".action-menu__list").screenshot({ path: resolve(out, `${tag}-menu.png`) });
    const progress = first.filter((item) =>
      /^(Mark as )?(planned|visited|skipped)$/i.test(item.label),
    );
    const booking = first.find((item) => /^(Mark as )?(not )?booked$/i.test(item.label));
    check(
      progress.length === 3,
      `${tag}: the menu offers three visit-progress items`,
      progress.map((i) => i.label),
    );
    check(
      progress.every((item) => item.role === "menuitemradio"),
      `${tag}: visit progress items are radio items`,
      progress.map((i) => i.role),
    );
    const current = progress.filter((item) => item.checked === "true");
    check(
      current.length === 1 && /planned/i.test(current[0].label),
      `${tag}: exactly Planned is checked for a new stop`,
      progress.map((i) => `${i.label}=${i.checked}`),
    );
    check(
      current.every((item) => !item.disabled),
      `${tag}: the current progress is not shown as disabled`,
      current,
    );
    check(
      progress.filter((item) => item.checked !== "true").every((item) => !item.icon),
      `${tag}: unchecked progress items carry no tick`,
      progress.map((i) => `${i.label}:${i.icon ? "tick" : "none"}`),
    );
    check(
      current.every((item) => item.icon),
      `${tag}: the checked progress item carries a tick`,
      current.map((i) => i.label),
    );
    check(
      booking?.role === "menuitemcheckbox" && booking.checked === "false" && !booking.icon,
      `${tag}: Booked is an unchecked checkbox item with no tick`,
      booking,
    );
    const last = first.at(-1);
    check(last?.label === "Remove" && last.danger, `${tag}: Remove is the last item`, last?.label);
    const edit = first.find((item) => item.label === "Edit details");
    const again = first.find((item) => item.label === "Add again");
    check(
      edit && again && edit.icon !== again.icon,
      `${tag}: Add again and Edit details use different icons`,
    );
    if (journey.phone) {
      check(
        first.every((item) => item.height >= 44),
        `${tag}: every menu item is at least 44 px`,
        first.filter((item) => item.height < 44).map((i) => `${i.label}:${i.height}`),
      );
    }

    await choose(progress.find((item) => /visited/i.test(item.label)).label);
    const visited = await openMenu();
    const nowChecked = visited.filter((item) => item.checked === "true").map((i) => i.label);
    check(
      nowChecked.length === 1 && /visited/i.test(nowChecked[0]),
      `${tag}: after choosing Visited, only Visited is checked`,
      nowChecked,
    );
    await choose(visited.find((item) => /booked$/i.test(item.label)).label);
    const booked = await openMenu();
    results[tag].booked = booked;
    await page
      .locator(".action-menu__list")
      .screenshot({ path: resolve(out, `${tag}-booked.png`) });
    const bookedItem = booked.find((item) => /booked$/i.test(item.label));
    check(
      bookedItem?.checked === "true" && bookedItem.icon,
      `${tag}: after choosing Booked, Booked is checked with a tick`,
      bookedItem,
    );
    await page.keyboard.press("Escape");
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
