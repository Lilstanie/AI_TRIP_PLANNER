// Failure inventory: separate categories bypass total limit; pets share the people cap;
// removing one person does not re-enable additions; API known/brief bypass limits;
// translated helper or phone layout loses the rule. Run against local mock-mode dev.
// PLAYWRIGHT=<package path> CHANNEL=chrome node apps/web/tests/e2e/traveller-limits.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/traveller-limits");
mkdirSync(OUT, { recursive: true });
const results = [];
function check(ok, message) {
  results.push({ ok, message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
}
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE);
  await page.getByRole("button", { name: "Who", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Who", exact: true });
  for (const [name, count] of [
    ["Add an adult", 4],
    ["Add a child", 2],
    ["Add an infant", 1],
    ["Add a senior", 2],
  ]) {
    for (let i = 0; i < count; i++) await dialog.getByRole("button", { name, exact: true }).click();
  }
  const peopleButtons = ["Add an adult", "Add a child", "Add an infant", "Add a senior"];
  for (const name of peopleButtons)
    check(
      await dialog.getByRole("button", { name, exact: true }).isDisabled(),
      `${name} stops at nine people`,
    );
  check(
    await dialog.getByRole("button", { name: "Add a pet", exact: true }).isEnabled(),
    "pets remain independent of nine people",
  );
  for (let i = 0; i < 3; i++)
    await dialog.getByRole("button", { name: "Add a pet", exact: true }).click();
  check(
    await dialog.getByRole("button", { name: "Add a pet", exact: true }).isDisabled(),
    "fourth pet is blocked",
  );
  await dialog.getByRole("button", { name: "Remove a child", exact: true }).click();
  check(
    await dialog.getByRole("button", { name: "Add an adult", exact: true }).isEnabled(),
    "removing a person frees one slot",
  );
  await dialog.getByRole("button", { name: "Add an adult", exact: true }).click();
  check(
    await dialog.getByRole("button", { name: "Add a child", exact: true }).isDisabled(),
    "replacement consumes the shared slot",
  );
  await page.screenshot({ path: `${OUT}/desktop-en.png`, fullPage: true });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: /^Travellers:/ }).click();
  check(
    await dialog.getByRole("button", { name: "Add a pet", exact: true }).isDisabled(),
    "saved party retains its limit",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^旅行人员：/ }).click();
  check(
    await page
      .getByText("同行人员合计最多 9 人，宠物最多 3 个。宠物不计入人数。", { exact: true })
      .isVisible(),
    "Chinese explains both limits",
  );
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "phone has no horizontal overflow",
  );
  const phoneDialog = page.getByRole("dialog", { name: "同行人员", exact: true });
  await phoneDialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => {})),
    );
  });
  check(
    await phoneDialog.getByRole("button", { name: "保存", exact: true }).isVisible(),
    "phone retains the Save action",
  );
  await page.screenshot({ path: `${OUT}/phone-zh.png`, fullPage: true });
  check(errors.length === 0, `no page errors: ${errors.join(" | ")}`);

  const brief = {
    tripId: "limit-check",
    destination: "Sydney",
    dates: ["2026-11-01", "2026-11-04"],
    groupSize: 9,
    budgetTotal: 10000,
  };
  const party = { adults: 4, children: 2, infants: 1, seniors: 2, pets: 3 };
  for (const [label, extra] of [
    ["ten people without breakdown", { brief: { ...brief, groupSize: 10 } }],
    ["108 adults", { brief: { ...brief, groupSize: 108, party: { ...party, adults: 108 } } }],
    ["ten mixed people", { brief: { ...brief, party: { ...party, children: 3 } } }],
    ["four pets", { brief: { ...brief, party: { ...party, pets: 4 } } }],
    ["partial ten people", { known: { groupSize: 10 } }],
    ["partial four pets", { known: { party: { ...party, pets: 4 } } }],
  ]) {
    const response = await page.request.post(`${BASE}/api/chat`, {
      data: {
        tripId: "limit-check",
        message: "Plan my trip",
        dataMode: "mock",
        ...extra,
      },
    });
    check(response.status() === 400, `API rejects ${label} before planning (${response.status()})`);
  }
} finally {
  await browser.close();
  writeFileSync(`${OUT}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some(({ ok }) => !ok)) process.exit(1);
