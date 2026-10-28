import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, settle, startExamplePlan } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve(
  "output/playwright/trajectory-with-trip-open",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const shown = (page) =>
  page.evaluate(() => {
    const visible = (selector) => {
      const node = document.querySelector(selector);
      return Boolean(node && !node.closest("[hidden]") && node.getClientRects().length > 0);
    };
    return {
      trip: visible(".trip-workspace"),
      trajectory: visible("#chat-panel-trajectory"),
      conversation: visible("#chat-panel-conversation"),
      tripButton: document.querySelector(".trip-trigger")?.getAttribute("aria-expanded"),
      selected: document
        .querySelector('[role="tab"][aria-selected="true"][id^="chat-tab-"]')
        ?.id.replace("chat-tab-", ""),
    };
  });
const sameAs = async (page, expected) => {
  const now = await shown(page);
  return Object.entries(expected).every(([key, value]) => now[key] === value) ? true : now;
};

async function plan(page) {
  await openMockWorkspace(page, base);
  await startExamplePlan(page);
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
  await settle(page, 1200);
  await page.locator(".trip-trigger").waitFor({ timeout: 30_000 });
}

const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const tripButton = (page) => page.locator(".trip-trigger");
const openTrip = async (page) => {
  if ((await tripButton(page).getAttribute("aria-expanded")) !== "true")
    await tripButton(page).click();
  await page.locator(".trip-workspace").waitFor();
};

try {
  const context = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await plan(page);

  await tripButton(page).click();
  await page.locator(".trip-workspace").waitFor();
  check((await shown(page)).trip, "the Trip panel is open before the tabs are pressed");

  await tab(page, "Trajectory").click();
  await settle(page, 400);
  let now = await sameAs(page, {
    trip: false,
    trajectory: true,
    selected: "trajectory",
    tripButton: "false",
  });
  check(now === true, "Trajectory with Trip open shows Trajectory and closes Trip", now);
  await page.screenshot({ path: `${out}/trajectory-from-trip.png` });

  await openTrip(page);
  await tab(page, "Conversation").click();
  await settle(page, 400);
  now = await sameAs(page, {
    trip: false,
    conversation: true,
    selected: "conversation",
    tripButton: "false",
  });
  check(now === true, "Conversation with Trip open shows the conversation and closes Trip", now);
  await page.screenshot({ path: `${out}/conversation-from-trip.png` });

  await tab(page, "Trajectory").click();
  await settle(page, 400);
  await tripButton(page).click();
  await settle(page, 400);
  const reopened = (await shown(page)).trip;
  await tripButton(page).click();
  await settle(page, 400);
  now = await sameAs(page, { trip: false, trajectory: true, selected: "trajectory" });
  check(reopened, "the Trip button reopens the panel");
  check(now === true, "the chosen view is kept underneath after Trip closes again", now);

  await openTrip(page);
  await page.getByRole("button", { name: /^Agent Team/ }).click();
  const specialist = page.locator(".team-popover [role='button'], .team-popover button").first();
  const jumped = (await specialist.count()) > 0;
  check(jumped, "the Agent Team panel lists a specialist while Trip is open");
  if (jumped) {
    await specialist.click();
    await settle(page, 600);
    now = await sameAs(page, {
      trip: false,
      trajectory: true,
      selected: "trajectory",
      tripButton: "false",
    });
    check(now === true, "a team jump with Trip open shows Trajectory and closes Trip", now);
    await page.screenshot({ path: `${out}/team-jump-from-trip.png` });
  }

  await tab(page, "Conversation").click();
  await page.route("**/api/chat", async (route) => {
    await new Promise((done) => setTimeout(done, 6000));
    await route.continue();
  });
  await page.getByRole("textbox", { name: "Message AI Trip Planner" }).fill("Add a rest day");
  await page.keyboard.press("Enter");
  await settle(page, 600);
  const busy = await page.locator(".workspace-shell[aria-busy='true']").count();
  check(busy === 1, "the assistant is running", busy);
  await openTrip(page);
  await tab(page, "Trajectory").click();
  await settle(page, 400);
  now = await sameAs(page, { trip: false, trajectory: true, selected: "trajectory" });
  check(now === true, "Trajectory with Trip open while the assistant runs closes Trip", now);
  await page.screenshot({ path: `${out}/running.png` });
  await page.unroute("**/api/chat");
  await page.locator(".workspace-shell[aria-busy='false']").waitFor({ timeout: 60_000 });
  await context.close();

  const phone = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const small = await phone.newPage();
  small.on("pageerror", (error) => errors.push(String(error)));
  await openMockWorkspace(small, base);
  await startExamplePlan(small);
  await small.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
  await settle(small, 1200);
  await small.getByRole("tab", { name: /^Trip/ }).click();
  await settle(small, 600);
  check(
    (await small.getByRole("tab", { name: "Trajectory", exact: true }).count()) === 0 &&
      (await small.getByRole("tab", { name: "Conversation", exact: true }).count()) === 0,
    "no Conversation or Trajectory tab appears at phone width",
  );
  await small.getByRole("tab", { name: /^Chat/ }).click();
  await settle(small, 400);
  check(
    (await small.getByRole("tab", { name: /^Chat/ }).getAttribute("aria-selected")) === "true",
    "the phone Chat tab still leaves the Trip view",
  );
  await small.screenshot({ path: `${out}/phone.png` });
  await phone.close();

  check(errors.length === 0, "no page errors", errors);
} catch (error) {
  check(false, "the walkthrough completed", String(error).split("\n")[0]);
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
  if (checks.some((item) => !item.ok)) process.exitCode = 1;
}
