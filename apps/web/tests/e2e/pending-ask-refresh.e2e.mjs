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
  plan: {
    tripId: "pending-ask-existing-trip",
    brief: {
      tripId: "pending-ask-existing-trip",
      userId: "local",
      destination: "Atlantis",
      dates: ["2026-12-10", "2026-12-12"],
      groupSize: 2,
      budgetTotal: 2000,
    },
    round: 1,
    budgetTotal: 2000,
    estTotal: 0,
    overrunPct: -100,
    sections: [],
  },
  reply: "Need more details: tell me which one you mean.",
};
const results = [];
const requests = [];
const errors = [];
const lateResponseResults = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
};
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const viewport of [
    { width: 375, height: 812, language: "en-AU" },
    { width: 1440, height: 1000, language: "en-AU" },
    { width: 390, height: 844, language: "zh-CN" },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: viewport.language,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const zh = viewport.language.startsWith("zh");
    const labels = {
      answer: zh ? "你的回答" : "Your answer",
      next: zh ? "下一步" : "Next",
      previous: zh ? "上一个问题" : "Previous question",
      nextQuestion: zh ? "下一个问题" : "Next question",
      submit: zh ? "提交" : "Submit",
      skip: zh ? "跳过此问题" : "Skip this question",
      retry: zh ? "重试更新" : "Retry update",
      stop: zh ? "停止规划" : "Stop planning",
      dismiss: zh ? "关闭所有问题" : "Dismiss all questions",
    };
    page.on("pageerror", (error) => errors.push(String(error)));
    let failNextAnswer = true;
    let holdNextAnswer = false;
    let answerStarted;
    let releaseAnswer;
    let holdLateResponse = false;
    let lateResponseStarted;
    let releaseLateResponse;
    let lateResponseSettled;
    await page.route("**/api/chat", async (route) => {
      const request = route.request().postDataJSON();
      requests.push(request);
      if (request.message.startsWith("Which Atlantis:") && failNextAnswer) {
        failNextAnswer = false;
        if (holdNextAnswer) {
          holdNextAnswer = false;
          answerStarted();
          await new Promise((resolve) => {
            releaseAnswer = resolve;
          });
        }
        await route.fulfill({ status: 500, contentType: "text/plain", body: "Temporary failure" });
        return;
      }
      if (request.message.startsWith("Which Atlantis:") && holdLateResponse) {
        holdLateResponse = false;
        lateResponseStarted();
        await new Promise((resolve) => {
          releaseLateResponse = resolve;
        });
        try {
          await route.fulfill({
            contentType: "application/x-ndjson",
            body:
              JSON.stringify({
                type: "needs_info",
                question: "Late answer applied.",
                known: frame.known,
              }) + "\n",
          });
          lateResponseResults.push("fulfilled");
        } catch {
          lateResponseResults.push("request-aborted");
        } finally {
          lateResponseSettled();
        }
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
    await page.goto(`${BASE}/debug/question`);
    check(
      (await page.getByRole("heading", { name: "How busy should each day be?" }).count()) === 1,
      `${viewport.width}: debug question renders without a progress persistence callback`,
    );
    await page.goto(BASE);
    await page.waitForSelector(".workspace-app");
    await page.waitForFunction(
      (language) => document.documentElement.lang === language,
      zh ? "zh-CN" : "en-AU",
    );
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page
      .getByRole("textbox", { name: zh ? "向 AI 旅行规划助手发送消息" : "Message AI Trip Planner" })
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
    await page.evaluate(() => {
      const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3"));
      const conversation = catalog.conversations.find(
        (item) => item.id === catalog.activeConversationId,
      );
      conversation.ask.progress = {
        index: 0,
        drafts: [
          {
            selected: ["Atlantis The Palm, Dubai", "Atlantis Paradise Island, Bahamas"],
            custom: "",
            skipped: false,
          },
          { selected: [], custom: "", skipped: false },
        ],
      };
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
    });
    await page.reload();
    await page.waitForSelector(".workspace-app");
    await page.getByRole("heading", { name: "Which Atlantis do you mean?" }).waitFor();
    check(
      await choice.isVisible(),
      `${viewport.width}: unanswered question and options survive reload`,
    );
    check(
      (await page.getByRole("radio", { checked: true }).count()) === 0,
      `${viewport.width}: malformed multi-answer progress for a single-select question is discarded`,
    );
    check(
      (await page.getByRole("button", { name: labels.skip }).count()) === 1 &&
        (await page.getByRole("button", { name: labels.next, exact: true }).count()) === 1,
      `${viewport.width}: unanswered question restores continue and skip actions`,
    );
    await choice.click();
    const customAnswer = page.getByRole("textbox", { name: labels.answer });
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
        (await page.getByRole("button", { name: labels.skip }).count()) === 1 &&
          (await page.getByRole("button", { name: labels.submit, exact: true }).count()) === 1,
        `${viewport.width}: restored question offers submit and skip actions`,
      );
      await page.getByRole("button", { name: labels.previous }).click();
      check(await choice.isChecked(), `${viewport.width}: earlier selected answer survives reload`);
      await page.getByRole("button", { name: labels.nextQuestion }).click();
      check(
        (await customAnswer.inputValue()) === "A quiet room near the beach",
        `${viewport.width}: later custom answer survives reload`,
      );
      holdNextAnswer = true;
      const answerRequest = new Promise((resolve) => {
        answerStarted = resolve;
      });
      await page.getByRole("button", { name: labels.submit, exact: true }).click();
      await answerRequest;
      const remainsWhileSubmitting =
        (await page
          .getByRole("heading", { name: "What matters most for your arrival?" })
          .count()) === 1 &&
        (await page.getByRole("button", { name: labels.dismiss }).isDisabled());
      check(
        remainsWhileSubmitting,
        `${viewport.width}: question cannot be dismissed while submitting`,
      );
      const skipWhileSubmitting = page.getByRole("button", { name: labels.skip });
      const answerWhileSubmitting = page.getByRole("textbox", { name: labels.answer });
      const previousWhileSubmitting = page.getByRole("button", { name: labels.previous });
      check(
        (await skipWhileSubmitting.isDisabled()) &&
          (await answerWhileSubmitting.isDisabled()) &&
          (await previousWhileSubmitting.isDisabled()) &&
          (await page.getByRole("button", { name: labels.submit, exact: true }).isDisabled()),
        `${viewport.width}: skip, answer editing and paging are locked during submission`,
      );
      const savedDuringSubmit = await page.evaluate(() =>
        localStorage.getItem("trip-workspace-catalog-v3"),
      );
      await page.waitForTimeout(300);
      check(
        savedDuringSubmit ===
          (await page.evaluate(() => localStorage.getItem("trip-workspace-catalog-v3"))),
        `${viewport.width}: busy question actions cannot change the persisted draft`,
      );
      releaseAnswer();
      await page.getByRole("button", { name: labels.retry }).waitFor();
      await page.reload();
      await page.waitForSelector(".workspace-app");
      await page.getByRole("heading", { name: "What matters most for your arrival?" }).waitFor();
      const answerableAfterFailure =
        (await page
          .getByRole("heading", { name: "What matters most for your arrival?" })
          .count()) === 1 &&
        (await customAnswer.inputValue()) === "A quiet room near the beach" &&
        (await page.getByRole("button", { name: labels.skip }).count()) === 1 &&
        (await page.getByRole("button", { name: labels.submit, exact: true }).count()) === 1;
      check(
        answerableAfterFailure,
        `${viewport.width}: failed submission keeps the selected question answerable`,
      );
      await page.screenshot({ path: `${OUT}/${viewport.width}-failed-answer.png` });
      if (answerableAfterFailure) {
        holdLateResponse = true;
        const lateAnswerRequest = new Promise((resolve) => {
          lateResponseStarted = resolve;
        });
        const lateAnswerSettled = new Promise((resolve) => {
          lateResponseSettled = resolve;
        });
        await page.getByRole("button", { name: labels.submit, exact: true }).click();
        await lateAnswerRequest;
        const stopName = page.getByRole("button", { name: labels.stop });
        const stopReachable = await stopName.isVisible();
        check(stopReachable, `${viewport.width}: Stop is reachable while answering`);
        if (stopReachable) await stopName.click();
        releaseLateResponse();
        await lateAnswerSettled;
        const retainedAfterStop =
          stopReachable &&
          (await page
            .getByRole("heading", { name: "What matters most for your arrival?" })
            .count()) === 1 &&
          (await customAnswer.inputValue()) === "A quiet room near the beach" &&
          !(await page.getByText("Late answer applied.", { exact: true }).count());
        check(
          retainedAfterStop,
          `${viewport.width}: Stop keeps the pending draft and ignores a late response`,
        );
        if (stopReachable) {
          await page.getByRole("button", { name: labels.submit, exact: true }).click();
          await page.getByText("Answer received.", { exact: true }).waitFor();
          check(
            requests.at(-1).message ===
              "Which Atlantis: Atlantis The Palm, Dubai\nArrival preference: A quiet room near the beach",
            `${viewport.width}: restored answers submit in question order`,
          );
          check(
            requests.at(-1).plan?.tripId === "pending-ask-existing-trip" &&
              requests.at(-1).known?.destination === "Atlantis",
            `${viewport.width}: answer retry retains the existing plan and known brief`,
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
          await page
            .getByRole("textbox", {
              name: zh ? "向 AI 旅行规划助手发送消息" : "Message AI Trip Planner",
            })
            .fill("Add one more preference");
          await page.keyboard.press("Enter");
          await page.getByRole("heading", { name: "Which Atlantis do you mean?" }).waitFor();
          await choice.click();
          await page.getByRole("button", { name: labels.skip }).click();
          await page
            .getByText("Need more details: tell me which one you mean.", { exact: true })
            .last()
            .waitFor();
          check(
            requests.at(-1).message.includes("Arrival preference: no preference") &&
              requests.at(-1).plan?.tripId === "pending-ask-existing-trip" &&
              requests.at(-1).known?.destination === "Atlantis",
            `${viewport.width}: skip submission retains existing plan and known brief`,
          );
        } else {
          await page.getByText("Late answer applied.", { exact: true }).waitFor();
        }
      }
    }
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${viewport.width}: no horizontal page overflow`,
    );
    await context.close();
  }
  check(errors.length === 0, "no browser page errors");
  check(
    lateResponseResults.length === 3,
    "each held late response was released after the Stop attempt",
  );
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
