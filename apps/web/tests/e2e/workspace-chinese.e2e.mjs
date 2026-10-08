// Failure inventory: English controls in Chinese sidebar, chat, trip, timeline or settings;
// untranslated accessible names or storage-full notice; raw traveller/model text altered; overflow at phone width;
// authored notices that skip the dictionary (attachment limit, unreadable stream frames, edit blockers,
// failed preview or place search) still showing in English.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/workspace-chinese");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name) => {
  results.push({ ok, name });
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      locale: "zh-CN",
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    // At phone width the language switch lives on the Mine tab; the document language shows the choice.
    await page.waitForFunction(() => document.documentElement.lang === "zh-CN");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const phone = width === 390;
    check(
      await page.getByRole("textbox", { name: "向 AI 旅行规划助手发送消息" }).isVisible(),
      `${width}: chat accessible name Chinese`,
    );
    await page.locator(".chat-empty__suggestions button").first().click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180000 });
    if (phone) await page.getByRole("tab", { name: /^行程/ }).click();
    else await page.getByRole("button", { name: "打开你的行程" }).click();
    await page.locator(".trip-panel").waitFor();
    check(
      await page.getByText("预计总额", { exact: true }).isVisible(),
      `${width}: trip summary Chinese`,
    );
    const english =
      /Estimated total|Within budget|Over budget|Timeline & routes|Review plan|View details|Price unknown|Estimated data|Mock data|Edit itinerary|Travel tips|Also found|Schedule on a day|Restaurant suggestion|Night \d+ of/;
    check(
      !english.test(await page.locator(".trip-panel").innerText()),
      `${width}: no English authored trip labels`,
    );
    check(
      (await page.locator(".trip-tips summary", { hasText: "旅行提示" }).count()) === 1,
      `${width}: the travel tips heading is Chinese`,
    );
    // The day's timeline is part of the Trip drawer; there is no separate tab.
    await page.getByRole("region", { name: "行程时间线" }).waitFor();
    // A stop's action menu is the timeline's Chinese control (the day has no route check any more).
    check(
      (await page
        .getByRole("region", { name: "行程时间线" })
        .getByRole("button", { name: /的操作/ })
        .count()) > 0,
      `${width}: timeline controls Chinese`,
    );
    check(
      !/Check routes|Edit stop|Apply edit|Undo edit|Price unknown|Show on map/.test(
        await page.locator(".trip-panel").innerText(),
      ),
      `${width}: no English authored timeline labels`,
    );
    await page
      .getByRole("region", { name: "行程时间线" })
      .evaluate((el) =>
        Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {}))),
      );
    await page.screenshot({ path: `${out}/${width}-timeline.png`, fullPage: true });
    await page.keyboard.press("Escape");
    if (phone) {
      await page.getByRole("tab", { name: /^我的/ }).click();
      await page.getByRole("button", { name: "设置与账户", exact: true }).click();
    } else await page.locator('button[aria-label^="账户设置："]:visible').first().click();
    const dialog = page.getByRole("dialog");
    for (const tab of ["编辑个人资料", "你的账户", "个性化", "语言与地区", "已连接账户"]) {
      await dialog.getByRole("tab", { name: tab, exact: true }).click();
      check(
        !/Save preferences|First name|Last name|Location|Theme|Communication style|Standing preferences|Home base|Accounts are not set up|Sign in|Long-term memory|Default trip data|Connected accounts/.test(
          await dialog.innerText(),
        ),
        `${width}: ${tab} has no English authored labels`,
      );
    }
    await dialog.getByRole("tab", { name: "个性化" }).click();
    await page.getByText("交流风格", { exact: true }).waitFor();
    await page
      .locator(".settings-panel")
      .evaluate((el) =>
        Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {}))),
      );
    await page.screenshot({ path: `${out}/${width}-settings.png`, fullPage: true });
    await page.keyboard.press("Escape");
    if (phone) await page.getByRole("tab", { name: /^聊天/ }).click();
    await page.route("**/api/chat", (route) =>
      route.fulfill({ status: 503, contentType: "text/plain", body: "unavailable" }),
    );
    await page.getByRole("textbox", { name: "向 AI 旅行规划助手发送消息" }).fill("test failure");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    const fallbackError = page.getByRole("alert").filter({ hasText: "请求失败（503）。" }).first();
    await fallbackError.waitFor();
    check(await fallbackError.isVisible(), `${width}: authored HTTP fallback error Chinese`);
    await page.unroute("**/api/chat");
    check(errors.length === 0, `${width}: no page errors ${errors.join(" | ")}`);
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}: no overflow`,
    );
    await context.close();
  }
  // Storage that refuses every write must still explain itself in Chinese.
  const full = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1440, height: 1000 },
  });
  await full.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  const fullPage = await full.newPage();
  await fullPage.goto(process.env.BASE_URL ?? "http://localhost:3000");
  const storageError = fullPage.getByText("浏览器存储不可用或已满", { exact: false }).first();
  await storageError.waitFor();
  check(await storageError.isVisible(), "storage-full notice Chinese");
  await fullPage.screenshot({ path: `${out}/1440-storage-full.png` });
  await full.close();
  // Authored notices built in code rather than passed through t() still read in Chinese (#189).
  const notices = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1440, height: 1000 },
  });
  const np = await notices.newPage();
  const noticeErrors = [];
  np.on("pageerror", (e) => noticeErrors.push(String(e)));
  await np.goto(process.env.BASE_URL ?? "http://localhost:3000");
  await np.getByRole("button", { name: "切换至 English" }).waitFor();
  // A real mock plan, then a time edit previewed through the real route.
  await np.locator(".chat-empty__suggestions button").first().click();
  await np.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180000 });
  await np.getByRole("button", { name: "打开你的行程" }).click();
  const timeline = np.getByRole("region", { name: "行程时间线" });
  await timeline.waitFor();
  await timeline.locator(".timeline-stop .timeline-stop__main").first().click();
  // Tapping the time opens its Start and End form.
  await timeline.locator(".timeline-stop__time").first().click();
  const end = timeline.getByLabel(/^结束/).first();
  const [endHour, endMinute] = (await end.inputValue()).split(":").map(Number);
  await end.fill(
    `${String(Math.min(endHour + 1, 22)).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`,
  );
  // A refused edit can leave the time form closed; tapping the time opens it again.
  const changeTime = async () => {
    const submit = timeline.getByRole("button", { name: "修改时间", exact: true });
    if (!(await submit.isVisible())) await timeline.locator(".timeline-stop__time").first().click();
    await submit.click();
  };
  // A refused edit leaves the plan unchanged and lists its blockers as alerts in the timeline.
  await np.route("**/api/trip/preview-edit", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.blockerNotices = [
      {
        key: "Day {day}: confirm the place for every stop first, so travel times between them can be checked.",
        params: { day: 2 },
      },
      {
        key: "Day {day}: {stop} needs at least {minutes} minutes after the previous activity.",
        params: { day: 1, stop: "Senso-ji Temple", minutes: 40 },
      },
      { key: "Day {day}: activity would extend beyond the day.", params: { day: 3 } },
      { key: "Route unavailable" },
      { key: "Route verification failed" },
    ];
    body.blockers = ["English blocker for older clients"];
    await route.fulfill({ response, json: body });
  });
  await changeTime();
  const alert = timeline.locator(".timeline-status--error");
  await alert.first().waitFor({ timeout: 30000 });
  const blockers = await alert.innerText();
  check(
    [
      "第 2 天：请先确认每个站点的地点，才能核查站点间的交通时间。",
      "第 1 天：Senso-ji Temple 需与上一项活动至少间隔 40 分钟。",
      "第 3 天：活动将超出当天时间。",
      "路线不可用",
      "路线核查失败",
    ].every((line) => blockers.includes(line)) &&
      !/Day \d|Route|minutes|English blocker/.test(blockers),
    `refused edit blockers Chinese (${blockers.replaceAll("\n", " | ")})`,
  );
  await np.screenshot({ path: `${out}/1440-edit-blockers.png` });
  await np.unroute("**/api/trip/preview-edit");
  // A failed preview or place search with no server wording falls back to authored notices.
  await np.route("**/api/trip/preview-edit", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await changeTime();
  const previewFailed = np.getByText("预览失败，请重新尝试此修改。").first();
  await previewFailed.waitFor({ timeout: 10000 }).catch(() => {});
  check(await previewFailed.isVisible(), "failed preview notice Chinese");
  await np.unroute("**/api/trip/preview-edit");
  // A refusal the route words as a notice reads in Chinese, not its English `error`.
  await np.route("**/api/trip/preview-edit", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "This edit is stale. Start from the current plan.",
        notice: { key: "This edit is stale. Start from the current plan." },
      }),
    }),
  );
  await changeTime();
  const previewRefused = np.getByText("此修改已过时，请基于当前行程重新修改。").first();
  await previewRefused.waitFor({ timeout: 10000 }).catch(() => {});
  check(await previewRefused.isVisible(), "refused preview notice Chinese");
  await np.unroute("**/api/trip/preview-edit");
  await np.route("**/api/places/search", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await timeline.getByRole("searchbox").first().fill("museum");
  await timeline.getByRole("button", { name: "搜索", exact: true }).first().click();
  const searchFailed = np.getByText("搜索失败，请重试。").first();
  await searchFailed.waitFor({ timeout: 10000 }).catch(() => {});
  check(await searchFailed.isVisible(), "failed place search notice Chinese");
  await np.screenshot({ path: `${out}/1440-search-failed.png` });
  await np.unroute("**/api/places/search");
  await np.keyboard.press("Escape");
  await np.getByLabel("添加文件").setInputFiles(
    [1, 2, 3, 4].map((n) => ({
      name: `note-${n}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(`note ${n}`),
    })),
  );
  const limit = np.getByRole("status").filter({ hasText: "每条消息最多可添加 4 个文件。" });
  await limit.waitFor({ timeout: 10000 }).catch(() => {});
  check(await limit.isVisible(), "attachment limit notice Chinese");
  await np.reload();
  await np.getByRole("button", { name: "切换至 English" }).waitFor();
  // The planning stream is a system boundary: frames the client cannot use get authored notices.
  for (const [frame, text, name] of [
    [{ type: "complete", response: {} }, "返回的行程方案无效，请重试。", "invalid plan frame"],
    [{ type: "ask_user" }, "助手提出的问题无效，请重试。", "invalid question frame"],
    [{ type: "flight_answer" }, "返回的票价无效，请重试。", "invalid fares frame"],
    [{ type: "error" }, "规划失败，请重试。", "error frame without text"],
  ]) {
    await np.route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: `${JSON.stringify(frame)}\n`,
      }),
    );
    await np.getByRole("textbox", { name: "向 AI 旅行规划助手发送消息" }).fill(name);
    await np.getByRole("button", { name: "发送", exact: true }).click();
    const alert = np.getByText(text, { exact: false }).first();
    await alert.waitFor({ timeout: 10000 }).catch(() => {});
    check(await alert.isVisible(), `${name} notice Chinese`);
    await np.unroute("**/api/chat");
    await np.reload();
    await np.getByRole("button", { name: "切换至 English" }).waitFor();
  }
  check(noticeErrors.length === 0, `notices: no page errors ${noticeErrors.join(" | ")}`);
  await notices.close();
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((x) => !x.ok)) process.exit(1);
