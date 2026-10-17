import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/where-sheet-save");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const [width, height] of [
    [375, 812],
    [390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    let chatRequest;
    let chatCount = 0;
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/api/data-mode", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: {
          ...body,
          configured: "live",
          providers: { ...body.providers, maps: true },
        },
      });
    });
    await page.route("**/api/places/search", async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({
        json: {
          places:
            body.text === "Sydney"
              ? [
                  {
                    id: "sydney",
                    displayName: { text: "Sydney" },
                    location: { latitude: -33.8688, longitude: 151.2093 },
                  },
                ]
              : [],
        },
      });
    });
    await page.route("**/api/chat", async (route) => {
      chatRequest = route.request().postDataJSON();
      chatCount += 1;
      await route.fulfill({
        contentType: "application/x-ndjson",
        body:
          JSON.stringify(
            chatCount === 1
              ? {
                  type: "ask_user",
                  questions: [
                    {
                      id: "historical-dates",
                      question: "Are these dates correct?",
                      options: [{ label: "Yes" }, { label: "No" }],
                    },
                  ],
                  known: {
                    destination: "Sydney",
                    groupSize: 1,
                    budgetTotal: 2000,
                    dates: ["2020-01-01", "2020-01-02"],
                  },
                  reply: "Confirm these dates to continue.",
                }
              : { type: "needs_info", question: "Answer received." },
          ) + "\n",
      });
    });

    await page.goto(BASE);
    await page.locator(".phone-tabbar").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const tab = (name) =>
      page.locator(".phone-tabbar").getByRole("tab", { name: new RegExp(`^${name}`) });

    await tab("Trip").click();
    await page.getByRole("button", { name: "Add trip details" }).first().click();
    const destination = page.locator("#fact-destination");
    await destination.waitFor();
    const save = page.getByRole("button", { name: "Save" }).last();

    await save.click();
    await page.waitForTimeout(600);
    const open = (await destination.count()) > 0 && (await destination.isVisible());
    check(open, `${width}: Save with no destination keeps the Where sheet open`);
    if (!open) {
      check(false, `${width}: the empty City or region field is marked invalid`);
      check(false, `${width}: the sheet explains that a destination is needed`);
      await context.close();
      continue;
    }
    check(
      (await destination.getAttribute("aria-invalid")) === "true",
      `${width}: the empty City or region field is marked invalid`,
    );
    check(
      await page.getByText("Enter a destination.", { exact: true }).isVisible(),
      `${width}: the sheet explains that a destination is needed`,
    );

    await destination.fill("Sydney");
    await page.getByRole("option", { name: /Sydney/ }).click();
    await save.click();
    await destination.waitFor({ state: "hidden" });
    check(
      await page.locator(".phone-tabbar").isVisible(),
      `${width}: a filled destination saves and closes the sheet`,
    );
    await page.locator(".phone-tabbar").getByRole("tab", { name: /^Chat/ }).click();
    await page.locator(".composer__input").fill("Plan a trip to Sydney.");
    const chatRequestSent = page.waitForRequest(
      (request) => request.url().endsWith("/api/chat") && request.method() === "POST",
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await chatRequestSent;
    check(
      chatRequest?.destinationLocation?.destination === "Sydney" &&
        chatRequest?.destinationLocation?.latitude === -33.8688 &&
        chatRequest?.destinationLocation?.longitude === 151.2093,
      `${width}: real destination selection reaches a fresh chat request`,
    );
    await page.getByRole("radio", { name: "Yes", exact: true }).click();
    const answerRequestSent = page.waitForRequest(
      (request) => request.url().endsWith("/api/chat") && request.method() === "POST",
    );
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await answerRequestSent;
    check(
      chatRequest?.destinationLocation?.destination === "Sydney" &&
        chatRequest?.destinationLocation?.latitude === -33.8688 &&
        chatRequest?.destinationLocation?.longitude === 151.2093,
      `${width}: answering date clarification preserves destination coordinates`,
    );
    await page.screenshot({ path: `${OUT}/${width}.png` });
    check(errors.length === 0, `${width}: no page errors`);
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
