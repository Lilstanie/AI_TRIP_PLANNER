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
    {
      id: "arrival",
      header: "Arrival preference",
      question: "What matters most for your arrival?",
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
    let failNextAnswer = true;
    await page.route("**/api/chat", async (route) => {
      const request = route.request().postDataJSON();
      requests.push(request);
      if (request.message.startsWith("Which Atlantis:") && failNextAnswer) {
        failNextAnswer = false;
        await route.fulfill({ status: 500, contentType: "text/plain", body: "Temporary failure" });
        return;
      }
      await route.fulfill({
        contentType: "application/x-ndjson",
        body:
          JSON.stringify(
            request.message.startsWith("Which Atlantis:")
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
    const choice = page.getByRole("radio", { name: /Atlantis The Palm, Dubai/ });
    await choice.waitFor();
    await page.waitForFunction(() => {
      const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
      const conversation = catalog?.conversations?.find(
        (item) => item.id === catalog.activeConversationId,
      );
      return conversation?.ask?.questions?.[0]?.header === "Which Atlantis";
    });
    await page.reload();
    await page.waitForSelector(".workspace-app");
    await page.getByRole("heading", { name: "Which Atlantis do you mean?" }).waitFor();
    check(
      await choice.isVisible(),
      `${viewport.width}: unanswered question and options survive reload`,
    );
    check(
      (await page.getByRole("button", { name: "Skip this question" }).count()) === 1 &&
        (await page.getByRole("button", { name: "Next", exact: true }).count()) === 1,
      `${viewport.width}: unanswered question restores continue and skip actions`,
    );
    await choice.click();
    const customAnswer = page.getByRole("textbox", { name: "Your answer" });
    await customAnswer.fill("A quiet room near the beach");
    await page.waitForFunction(() =>
      localStorage
        .getItem("trip-workspace-catalog-v3")
        ?.includes('"custom":"A quiet room near the beach"'),
    );
    await page.screenshot({ path: `${OUT}/${viewport.width}-before.png` });
    writeFileSync(
      `${OUT}/${viewport.width}-storage-before.json`,
      await page.evaluate(() => localStorage.getItem("trip-workspace-catalog-v3")),
    );
    await page.reload();
    await page.waitForSelector(".workspace-app");
    await page.getByRole("heading", { name: "What matters most for your arrival?" }).waitFor();
    await page.screenshot({ path: `${OUT}/${viewport.width}-after.png` });
    const restored = (await customAnswer.inputValue()) === "A quiet room near the beach";
    check(restored, `${viewport.width}: pending question and current step survive reload`);
    check(
      restored && (await page.locator(".question__progress").textContent())?.trim() === "2 / 2",
      `${viewport.width}: current question position survives reload`,
    );
    check(
      (await page
        .getByText("Need more details: tell me which one you mean.", { exact: true })
        .count()) === 1,
      `${viewport.width}: assistant history survives`,
    );
    if (restored) {
      check(
        (await page.getByRole("button", { name: "Skip this question" }).count()) === 1 &&
          (await page.getByRole("button", { name: "Submit", exact: true }).count()) === 1,
        `${viewport.width}: restored question offers submit and skip actions`,
      );
      await page.getByRole("button", { name: "Previous question" }).click();
      check(await choice.isChecked(), `${viewport.width}: earlier selected answer survives reload`);
      await page.getByRole("button", { name: "Next question" }).click();
      check(
        (await customAnswer.inputValue()) === "A quiet room near the beach",
        `${viewport.width}: later custom answer survives reload`,
      );
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await page.getByRole("button", { name: "Retry update" }).waitFor();
      const answerableAfterFailure =
        (await page
          .getByRole("heading", { name: "What matters most for your arrival?" })
          .count()) === 1 &&
        (await customAnswer.inputValue()) === "A quiet room near the beach" &&
        (await page.getByRole("button", { name: "Skip this question" }).count()) === 1 &&
        (await page.getByRole("button", { name: "Submit", exact: true }).count()) === 1;
      check(
        answerableAfterFailure,
        `${viewport.width}: failed submission keeps the selected question answerable`,
      );
      await page.screenshot({ path: `${OUT}/${viewport.width}-failed-answer.png` });
      if (answerableAfterFailure) {
        await page.getByRole("button", { name: "Submit", exact: true }).click();
        await page.getByText("Answer received.", { exact: true }).waitFor();
        check(
          requests.at(-1).message ===
            "Which Atlantis: Atlantis The Palm, Dubai\nArrival preference: A quiet room near the beach",
          `${viewport.width}: restored answers submit in question order`,
        );
        check(
          requests.at(-1).known?.budgetTotal === 2000 &&
            requests.at(-1).known?.destination === "Atlantis",
          `${viewport.width}: answer retains known brief`,
        );
        await page.waitForFunction(() => {
          const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
          const conversation = catalog?.conversations?.find(
            (item) => item.id === catalog.activeConversationId,
          );
          return conversation && !conversation.ask;
        });
        await page.reload();
        await page.waitForSelector(".workspace-app");
        await page.getByText("Answer received.", { exact: true }).waitFor();
        check(
          (await page
            .getByRole("heading", { name: "What matters most for your arrival?" })
            .count()) === 0,
          `${viewport.width}: submitted question does not reappear`,
        );
      }
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
