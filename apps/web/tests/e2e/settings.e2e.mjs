// End-to-end check of Settings while signed out (or on a deployment without accounts): travel
// defaults prefill a new trip, repeated New chat does not stack blank chats, appearance and default
// data mode apply and survive a reload, and the account section explains where data lives.
// Screenshots at desktop and phone widths land under output/playwright/settings/.
//
//   pnpm --filter @trip/web dev            # in another terminal
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/settings.e2e.mjs
//
// Signing in goes through Clerk's hosted pages and is verified by hand; see the session log.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/settings");
mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);

// Settings opens from the sidebar's account menu: Open account menu, then the section's menu item.
async function openSettings(page, section = "Personalization") {
  // Both the sidebar and the drawer hold one; only the visible one can be used.
  await page.locator('button[aria-label="Open account menu"]:visible').first().click();
  await page.getByRole("menuitem", { name: section }).click();
  await page.getByRole("dialog").waitFor();
  await settle(page, 300);
}

async function run(browser, { width, height, tag }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE);
  // The dev server's own badge sits over the account button at phone width and would take its clicks.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForSelector(".workspace-app");
  await page.waitForLoadState("networkidle");
  if (width < 1000) {
    // Narrow screens reach Settings through the navigation drawer.
    await page.getByRole("button", { name: "Open navigation" }).click();
    await settle(page);
  }

  // Personalization: the profile rows, communication style and memory switch.
  await openSettings(page);
  const dialog = page.getByRole("dialog");
  check(
    (await dialog.getByRole("tab", { name: "Personalization" }).getAttribute("aria-selected")) === "true",
    `${tag}: Settings opens on Personalization`,
  );
  check(await dialog.getByText("Any dietary restrictions or allergies?", { exact: false }).isVisible(), `${tag}: an empty fact asks its question`);
  await page.screenshot({ path: `${OUT}/${tag}-01-personalization.png` });
  const answer = async (label) => {
    await dialog.getByRole("button", { name: `Edit ${label}` }).click();
    await settle(page, 200);
  };
  await answer("Home base");
  await dialog.getByRole("textbox", { name: "Home base" }).fill("Melbourne");
  await dialog.getByRole("textbox", { name: "Home base" }).press("Enter");
  await answer("Travellers");
  await dialog.getByRole("textbox", { name: "Travellers" }).fill("3");
  await dialog.getByRole("textbox", { name: "Travellers" }).press("Enter");
  await answer("Pace");
  await dialog.getByRole("button", { name: "Relaxed" }).click();
  await answer("Interests");
  await dialog.getByRole("group", { name: "Interests" }).getByRole("button", { name: "Food" }).click();
  await answer("Dietary");
  await dialog.getByRole("group", { name: "Dietary needs" }).getByRole("button", { name: "Vegetarian" }).click();
  await answer("Trip budget");
  await dialog.getByRole("textbox", { name: /Budget/ }).fill("5200");
  await dialog.getByRole("textbox", { name: /Budget/ }).press("Enter");
  await answer("Standing preferences");
  await dialog.getByPlaceholder(/Add a trip preference/).fill("Vegetarian food");
  await dialog.getByPlaceholder(/Add a trip preference/).press("Enter");
  await dialog.getByRole("button", { name: "Save preferences" }).click();
  await answer("Loyalty");
  await dialog.getByLabel("Programme").fill("Qantas Frequent Flyer");
  await dialog.getByRole("button", { name: "Add membership" }).click();
  check(
    await dialog.getByRole("list", { name: "Your memberships" }).getByText("Qantas Frequent Flyer").isVisible(),
    `${tag}: a membership is added`,
  );
  check(await dialog.getByText("Home base:").locator("..").getByText("Melbourne").isVisible(), `${tag}: an answered fact shows its value`);
  await dialog.getByRole("combobox", { name: "Communication style" }).selectOption("concise");
  const memory = dialog.getByRole("switch", { name: "Long-term memory" });
  await memory.click();
  check((await memory.getAttribute("aria-checked")) === "false", `${tag}: memory switch turns off`);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("trip.settings.v1") ?? "{}"));
  check(
    stored.assistant?.style === "concise" && stored.assistant?.memory === false,
    `${tag}: style and memory are saved (${JSON.stringify(stored.assistant)})`,
  );
  await memory.click();
  await dialog.getByRole("combobox", { name: "Communication style" }).selectOption("neutral");
  await page.screenshot({ path: `${OUT}/${tag}-01b-personalization-filled.png`, fullPage: true });

  // Your account: theme applies at once; the section says where data lives.
  await dialog.getByRole("tab", { name: "Your account" }).click();
  await settle(page, 300);
  await dialog.getByRole("button", { name: "Change Theme" }).click();
  await dialog.getByRole("button", { name: "Dark" }).click();
  check(
    (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark",
    `${tag}: Dark sets the theme`,
  );
  check(
    (await dialog.getByText(/Sign in to keep|Accounts are not set up/).count()) === 1,
    `${tag}: account section says where data lives`,
  );
  await page.screenshot({ path: `${OUT}/${tag}-02-account.png` });

  // Language & region: the data default lives under Advanced.
  await dialog.getByRole("tab", { name: "Language & region" }).click();
  await settle(page, 300);
  check(await dialog.getByText("AUD (A$) — Australian Dollar").isVisible(), `${tag}: currency is shown`);
  await dialog.getByRole("button", { name: "Change Trip data" }).click();
  await dialog.getByRole("button", { name: "Sample data" }).click();
  await page.screenshot({ path: `${OUT}/${tag}-03-region.png` });

  // Edit profile: location is the same home city.
  await dialog.getByRole("tab", { name: "Edit profile" }).click();
  await settle(page, 300);
  check((await dialog.getByLabel("Location").inputValue()) === "Melbourne", `${tag}: profile location is the home base`);
  await page.screenshot({ path: `${OUT}/${tag}-04-profile.png` });
  await page.keyboard.press("Escape");
  await settle(page);

  // A new trip starts from the defaults; pressing New chat again reuses it.
  const chats = page.getByRole("button", { name: /^Chats/ });
  const newChat = async () => {
    if (width < 1000) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await settle(page);
    } else if (!(await page.getByRole("button", { name: "New chat" }).first().isVisible())) {
      await chats.click();
      await settle(page);
    }
    await page.getByRole("button", { name: "New chat" }).first().click();
    await settle(page, 700);
  };
  await newChat();
  const facts = await page.locator(".workspace-topbar").innerText();
  check(/3\s*travellers/i.test(facts), `${tag}: new trip has the default travellers (${facts.replace(/\s+/g, " ").slice(0, 80)})`);
  check(/5,?200/.test(facts), `${tag}: new trip has the default budget`);
  const prefs = await page.evaluate(() => {
    const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}");
    const active = catalog.conversations?.find((c) => c.id === catalog.activeConversationId);
    return active?.draft?.preferences ?? [];
  });
  check(
    prefs.some((p) => p.startsWith("Relaxed")) &&
      prefs.includes("Interests: Food") &&
      prefs.includes("Dietary: Vegetarian") &&
      prefs.includes("Vegetarian food"),
    `${tag}: new trip carries the travel profile as preferences (${JSON.stringify(prefs)})`,
  );
  await page.screenshot({ path: `${OUT}/${tag}-05-new-trip.png` });
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}").conversations?.length ?? 0,
  );
  await newChat();
  await newChat();
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}").conversations?.length ?? 0,
  );
  check(after === before, `${tag}: repeated New chat reuses the blank chat (${before} → ${after})`);

  // Everything survives a reload.
  await page.reload();
  await page.waitForSelector(".workspace-app");
  await settle(page, 1200);
  check(
    (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark",
    `${tag}: theme survives a reload`,
  );
  check(
    (await page.getByRole("button", { name: /^Mock data/ }).count()) === 1,
    `${tag}: default data mode applies after a reload`,
  );
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `${tag}: no sideways scroll`);
  check(!errors.length, `${tag}: no console errors${errors.length ? `: ${errors.join(" | ").slice(0, 300)}` : ""}`);
  await context.close();
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  await run(browser, { width: 1440, height: 1000, tag: "desktop" });
  await run(browser, { width: 390, height: 844, tag: "phone" });
} finally {
  await browser.close();
}
console.log(`\nScreenshots: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
