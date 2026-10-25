import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/progressive-empty-workspace", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const dismissLocation = async (page, language) => {
  const notNow = page.getByRole("button", { name: language === "zh" ? "暂不" : "Not now" });
  await notNow.waitFor({ timeout: 5000 }).then(
    () => notNow.click(),
    () => {},
  );
};

const composer = (page) => page.locator(".composer textarea, .composer__input, textarea").first();

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    locale: "en-AU",
  });
  await desktop.addInitScript(() => {
    localStorage.setItem(
      "trip.settings.v1",
      JSON.stringify({
        version: 1,
        travel: { homeCity: "", travellers: 2, budget: 4000, preferences: [] },
        language: "en",
        dataMode: "mock",
        appearance: "system",
        updatedAt: "2026-10-25T00:00:00Z",
      }),
    );
  });
  const page = await desktop.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await dismissLocation(page, "en");
  await page.locator(".chat-empty__suggestions").waitFor();

  check(
    (await page.getByRole("heading", { name: "Where to next?" }).count()) === 0,
    "desktop blank: no Where to next card",
  );
  check(
    (await page.locator(".fact-chips").count()) === 0,
    "desktop blank: Brief bar hidden despite Travel profile prefills",
  );
  check(
    (await page.getByRole("button", { name: "Open your trip" }).count()) === 0,
    "desktop blank: Trip hidden without a Plan",
  );
  check(
    (await page.getByRole("button", { name: /Switch language/i }).count()) === 0,
    "desktop blank: no language shortcut",
  );
  check(
    (await page.getByRole("tab", { name: "Conversation" }).count()) === 1 &&
      (await page.getByRole("button", { name: "Agent Team" }).count()) === 1,
    "desktop blank: Conversation tab and Agent Team top-left",
  );
  await page.locator(".data-mode:visible").waitFor();
  check(
    (await page.locator(".data-mode:visible").count()) === 1,
    "desktop blank: Live/Mock remains",
  );
  await page.screenshot({ path: `${OUT}/desktop-blank.png` });

  const input = composer(page);
  await input.click();
  const firstPlaceholder = await input.getAttribute("placeholder");
  await input
    .locator("xpath=.")
    .evaluate(
      (node, previous) =>
        new Promise((resolve, reject) => {
          const started = Date.now();
          const tick = () => {
            if (node.getAttribute("placeholder") !== previous) return resolve(true);
            if (Date.now() - started > 8000) return reject(new Error("placeholder did not rotate"));
            requestAnimationFrame(tick);
          };
          tick();
        }),
      firstPlaceholder,
    )
    .then(
      () => check(true, "focused empty composer rotates placeholders"),
      (error) => check(false, "focused empty composer rotates placeholders", String(error)),
    );
  await input.fill("Tokyo");
  await page.locator(".fact-chips").waitFor();
  check((await page.locator(".fact-chips").count()) === 1, "typing reveals Brief bar");
  check(
    (await page.locator(".chat-empty__suggestions").count()) === 0,
    "typing hides suggestion chips",
  );
  const whileTyping = await input.getAttribute("placeholder");
  await input.evaluate(
    (node) =>
      new Promise((resolve) => {
        const started = Date.now();
        const tick = () => {
          if (Date.now() - started > 5000) return resolve(node.getAttribute("placeholder"));
          requestAnimationFrame(tick);
        };
        tick();
      }),
  );
  check(
    (await input.getAttribute("placeholder")) === whileTyping,
    "typed text stops placeholder rotation",
    { whileTyping, later: await input.getAttribute("placeholder") },
  );
  await page.screenshot({ path: `${OUT}/desktop-typing.png` });

  await input.fill("");
  await page.locator(".chat-empty__suggestions").waitFor();
  check(
    (await page.locator(".fact-chips").count()) === 0 &&
      (await page.locator(".chat-empty__suggestions").count()) === 1,
    "clearing input restores blank untouched chrome",
  );

  await page.route("**/api/chat", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (/messaged-state/i.test(body.message ?? "")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "needs_info",
          question: "Which city are you thinking of?",
          known: {},
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: "complete",
        response: {
          reply: "Here is a starter plan.",
          plan: {
            tripId: "e2e-progressive",
            brief: {
              tripId: "e2e-progressive",
              userId: "local",
              destination: "Sydney",
              dates: ["2026-11-10", "2026-11-14"],
              groupSize: 2,
              budgetTotal: 4000,
            },
            round: 1,
            budgetTotal: 4000,
            estTotal: 200,
            overrunPct: -95,
            sections: [
              {
                id: "itinerary",
                label: "Day plan",
                status: "draft",
                summary: "Museum visit",
                estCost: 200,
                proposal: {
                  agent: "itinerary",
                  summary: "Museum visit",
                  items: [{ kind: "activity", detail: "Museum", estCost: 200 }],
                  assumptions: [],
                  conflictsWith: [],
                },
              },
            ],
          },
        },
      }),
    });
  });

  await input.fill("messaged-state please ask");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByText("Which city are you thinking of?").waitFor();
  check(
    (await page.locator(".fact-chips").count()) === 1 &&
      (await page.getByRole("button", { name: "Open your trip" }).count()) === 0,
    "messaged state keeps Brief bar without Trip",
  );
  await page.screenshot({ path: `${OUT}/desktop-messaged.png` });

  await page.getByRole("button", { name: /^Chats/ }).click();
  await page
    .locator(".chats-panel__actions")
    .getByRole("button", { name: "New chat", exact: true })
    .click();
  await page.locator(".chat-empty__suggestions").waitFor();
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.getByRole("button", { name: "Open your trip" }).waitFor({ timeout: 15000 });
  check(
    (await page.getByRole("button", { name: "Open your trip" }).count()) === 1,
    "Trip appears once a Plan exists",
  );
  const afterPlan = await composer(page).getAttribute("placeholder");
  check(
    afterPlan === "Tell me what to change…",
    "Plan uses a stable revision placeholder",
    afterPlan,
  );
  await page.screenshot({ path: `${OUT}/desktop-plan.png` });
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Language & region" }).click();
  const settings = page.getByRole("dialog");
  await settings.getByRole("button", { name: "Change Language", exact: true }).click();
  await settings.getByRole("button", { name: "简体中文", exact: true }).click();
  check(
    (await page.locator("html").getAttribute("lang")) === "zh-CN",
    "Settings switches interface to Chinese",
  );
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/desktop-plan-zh.png` });
  check(errors.length === 0, "desktop: no page errors", errors);
  await desktop.close();

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    locale: "en-AU",
  });
  await phone.addInitScript(() => {
    localStorage.setItem(
      "trip.settings.v1",
      JSON.stringify({
        version: 1,
        travel: { homeCity: "", preferences: [] },
        language: "en",
        dataMode: "mock",
        appearance: "system",
        updatedAt: "2026-10-25T00:00:00Z",
      }),
    );
  });
  const phonePage = await phone.newPage();
  const phoneErrors = [];
  phonePage.on("pageerror", (error) => phoneErrors.push(String(error)));
  await phonePage.goto(BASE, { waitUntil: "domcontentloaded" });
  await dismissLocation(phonePage, "en");
  await phonePage.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await phonePage.getByRole("tab", { name: /^Chat/ }).click();
  check(
    (await phonePage.getByRole("tab", { name: /^Trip/ }).count()) === 0,
    "phone blank: Trip tab hidden without a Plan",
  );
  check(
    await phonePage.evaluate(() => document.documentElement.scrollWidth === innerWidth),
    "phone blank: no horizontal overflow",
  );
  await phonePage.screenshot({ path: `${OUT}/phone-blank.png` });
  await composer(phonePage).fill("Tokyo");
  await phonePage.locator(".fact-chips").waitFor({ state: "attached" });
  check(
    (await phonePage.locator(".fact-chips").count()) === 1,
    "phone typing mounts Brief controls",
  );
  await composer(phonePage).blur();
  await phonePage.getByRole("button", { name: /^Trip details:/ }).click();
  const facts = phonePage.getByRole("dialog", { name: "Trip details", exact: true });
  await facts.getByRole("button", { name: "Preferences", exact: true }).waitFor();
  check(await facts.isVisible(), "phone Trip details exposes editable facts");
  await phonePage.screenshot({ path: `${OUT}/phone-facts.png` });
  await phonePage.keyboard.press("Escape");
  await phonePage.getByRole("tab", { name: "Mine", exact: true }).click();
  await phonePage.locator(".data-mode:visible").waitFor();
  check(
    (await phonePage.getByRole("button", { name: /Switch language/i }).count()) === 0,
    "phone Mine: no language shortcut",
  );
  check(
    (await phonePage.locator(".data-mode:visible").count()) === 1,
    "phone Mine: data mode remains",
  );
  await phonePage.screenshot({ path: `${OUT}/phone-mine.png` });
  check(phoneErrors.length === 0, "phone: no page errors", phoneErrors);
  await phone.close();
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/result.json`, JSON.stringify({ results }, null, 2));
}
if (results.some(({ ok }) => !ok)) process.exit(1);
