// Browser acceptance for interface language and display currency.
//
//   pnpm --filter @trip/web dev
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/localisation-currency.e2e.mjs
//
// Evidence lands under output/playwright/localisation-currency/.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/localisation-currency");
mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");

  const sidebarGap = await page.evaluate(() => {
    const sidebar = document.querySelector(".workspace-sidebar")?.getBoundingClientRect();
    const main = document.querySelector(".workspace-main")?.getBoundingClientRect();
    return sidebar && main ? main.left - sidebar.right : -1;
  });
  check(
    sidebarGap >= 8,
    `desktop separates the sidebar card from the main section (${sidebarGap}px)`,
  );

  await page.locator(".data-mode").waitFor();
  const languageToggle = page.getByRole("button", { name: "Switch language to 简体中文" });
  const languageToggleAvailable = (await languageToggle.count()) === 1;
  check(languageToggleAvailable, "top bar exposes a direct language switch");
  check(
    (await page.locator(".topbar-control-cluster > .data-mode + .language-toggle").count()) === 1,
    "language switch sits beside the data mode control",
  );
  if (languageToggleAvailable) {
    await languageToggle.click();
    check(
      (await page.locator("html").getAttribute("lang")) === "zh-CN",
      "top bar language switch changes the interface to Chinese",
    );
    await page.getByRole("button", { name: "切换至 English" }).click();
    check(
      (await page.locator("html").getAttribute("lang")) === "en",
      "top bar language switch changes the interface back to English",
    );
  }

  await page.getByRole("button", { name: /^Account settings:/ }).click();
  const settings = page.getByRole("dialog");
  await settings.getByRole("tab", { name: "Language & region" }).click();

  await settings.getByRole("button", { name: "Change Language" }).click();
  await settings.getByRole("button", { name: "简体中文" }).click();
  check(
    (await page.locator("html").getAttribute("lang")) === "zh-CN",
    "Chinese updates the document language",
  );
  check(
    await page.getByRole("button", { name: /^聊天/ }).isVisible(),
    "Chinese translates workspace navigation",
  );
  check(
    await page.getByRole("button", { name: /^行程/ }).isVisible(),
    "Chinese translates the trips navigation",
  );

  await settings.getByRole("button", { name: "更改 显示币种" }).click();
  await settings.getByRole("button", { name: "美元（USD）" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "预算" }).click();
  const budget = page.getByRole("dialog", { name: "预算" });
  const amount = budget.getByLabel("输入金额（USD）");
  await amount.fill("3000");
  await budget.getByRole("button", { name: "保存" }).click();
  check(
    await page.getByRole("button", { name: /预算.*USD.*3,000/ }).isVisible(),
    "Budget displays in USD",
  );

  await page.getByRole("button", { name: /^账户设置：/ }).click();
  await settings.getByRole("tab", { name: "语言与地区" }).click();
  await settings.getByRole("button", { name: "更改 显示币种" }).click();
  await settings.getByRole("button", { name: "目的地当地币种" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "去哪里" }).click();
  const where = page.getByRole("dialog", { name: "去哪里" });
  const destination = where.getByRole("group", { name: "目的地 1" });
  const origin = where.getByRole("group", { name: "出发地" });
  await destination.getByLabel("城市 *", { exact: true }).fill("Tokyo");
  await destination.getByLabel("国家 *", { exact: true }).fill("Japan");
  await origin.getByLabel("城市 *", { exact: true }).fill("Sydney");
  await origin.getByLabel("国家 *", { exact: true }).fill("Australia");
  await where.getByRole("button", { name: "保存" }).click();
  check(
    await page.getByRole("button", { name: /目的地.*Tokyo/ }).isVisible(),
    "Destination is saved",
  );
  check(
    await page.getByRole("button", { name: /预算.*JPY/ }).isVisible(),
    "Local currency follows the destination",
  );

  // A previous "saved" status can still be visible before the next debounced save starts.
  // Verify this edit reached storage rather than reloading on the old status.
  await page.waitForFunction(() => {
    const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
    return catalog?.conversations?.some(
      (item) =>
        item.draft?.destination === "Tokyo, Japan" &&
        item.draft?.locations?.origin?.country === "Australia",
    );
  });
  await page.reload();
  await page.waitForSelector(".workspace-app");
  check((await page.locator("html").getAttribute("lang")) === "zh-CN", "Language survives reload");
  check(
    await page.getByRole("button", { name: /预算.*JPY/ }).isVisible(),
    "Display currency survives reload",
  );
  check(
    !errors.length,
    `no browser errors${errors.length ? `: ${errors.join(" | ").slice(0, 300)}` : ""}`,
  );
  await page.screenshot({ path: `${OUT}/desktop-zh-local-jpy.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForSelector(".workspace-app");
  check(
    !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
    "phone layout has no horizontal page scroll",
  );
  check(
    await page.getByRole("button", { name: "打开导航" }).isVisible(),
    "phone keeps navigation available",
  );
  await page.screenshot({ path: `${OUT}/phone-zh-local-jpy.png`, fullPage: true });
  await page.close();
} finally {
  await browser.close();
}

console.log(`\nEvidence: ${OUT}`);
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
