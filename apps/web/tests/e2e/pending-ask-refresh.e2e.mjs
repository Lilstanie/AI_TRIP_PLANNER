import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(
  process.cwd(),
  "output/playwright/pending-ask-refresh",
  process.env.EVIDENCE_LABEL ?? new Date().toISOString().replace(/[:.]/g, "-"),
);
mkdirSync(OUT, { recursive: true });
const frame = {
  type: "ask_user",
  questions: [
    {
      id: "atlantis",
      header: "Which Atlantis",
      question: "Which Atlantis do you mean?",
      options: [
        { label: "Atlantis The Palm, Dubai", description: "A resort in Dubai." },
        { label: "Atlantis Paradise Island, Bahamas" },
        { label: "A different place called Atlantis" },
      ],
    },
  ],
  known: {
    destination: "Atlantis",
    groupSize: 2,
    budgetTotal: 2000,
    dates: ["2026-12-10", "2026-12-12"],
  },
  reply: "Need more details: tell me which one you mean.",
};
const results = [];
const requests = [];
const errors = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
};
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1440, height: 1000 },
  ]) {
    const context = await browser.newContext({
      viewport,
      locale: "en-AU",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/api/chat", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        contentType: "application/x-ndjson",
        body:
          JSON.stringify(
            requests.at(-1).message.startsWith("Which Atlantis:")
              ? { type: "needs_info", question: "Answer received.", known: frame.known }
              : frame,
          ) + "\n",
      });
    });
    await page.goto(BASE);
    await page.waitForSelector(".workspace-app");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page
      .getByRole("textbox", { name: "Message AI Trip Planner" })
      .fill("Plan 3 days in Atlantis for 2 people, budget AUD 2000, from 2026-12-10");
    await page.keyboard.press("Enter");
    await page.getByRole("radio", { name: /Atlantis The Palm, Dubai/ }).waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${viewport.width}-before.png` });
    writeFileSync(
      `${OUT}/${viewport.width}-storage-before.json`,
      await page.evaluate(() => localStorage.getItem("trip-workspace-catalog-v3")),
    );
    await page.reload();
    await page.waitForSelector(".workspace-app");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${viewport.width}-after.png` });
    const choice = page.getByRole("radio", { name: /Atlantis The Palm, Dubai/ });
    const restored = (await choice.count()) === 1;
    check(restored, `${viewport.width}: pending question survives reload`);
    check(
      (await page
        .getByText("Need more details: tell me which one you mean.", { exact: true })
        .count()) === 1,
      `${viewport.width}: assistant history survives`,
    );
    if (restored) {
      check(
        (await page.getByRole("radio", { name: /Atlantis Paradise Island, Bahamas/ }).count()) ===
          1,
        `${viewport.width}: alternative option survives`,
      );
      await choice.click();
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await page.getByText("Answer received.", { exact: true }).waitFor();
      check(
        requests.at(-1).message === "Which Atlantis: Atlantis The Palm, Dubai",
        `${viewport.width}: restored option submits formatted answer`,
      );
      check(
        requests.at(-1).known?.budgetTotal === 2000 &&
          requests.at(-1).known?.destination === "Atlantis",
        `${viewport.width}: answer retains known brief`,
      );
      await page.waitForTimeout(600);
      await page.reload();
      await page.waitForSelector(".workspace-app");
      check(
        (await page.getByRole("radio", { name: /Atlantis The Palm, Dubai/ }).count()) === 0,
        `${viewport.width}: submitted question does not reappear`,
      );
    }
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${viewport.width}: no horizontal page overflow`,
    );
    await context.close();
  }
  check(errors.length === 0, "no browser page errors");
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify({ results, errors, requests, fixture: frame }, null, 2),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
