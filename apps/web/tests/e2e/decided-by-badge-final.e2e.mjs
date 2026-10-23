import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/decided-by-badge-final", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const MARKERS = { en: ["Decided by AI", "Decided by code"], zh: ["AI 决定", "程序决定"] };
const MESSAGE = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const language of ["en", "zh"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
      locale: language === "zh" ? "zh-CN" : "en-AU",
    });
    await context.addInitScript((language) => {
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [] },
          language,
          dataMode: "mock",
          appearance: "system",
          updatedAt: "2026-10-23T00:00:00Z",
        }),
      );
      const original = window.fetch.bind(window);
      const pause = (ms) => new Promise((done) => setTimeout(done, ms));
      window.fetch = async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (!url.endsWith("/api/chat")) return original(input, init);
        const response = await original(input, init);
        const lines = (await response.text()).split("\n").filter(Boolean);
        const events = lines.map((line) => JSON.parse(line));
        const isCoordinatorReasoning = (event) =>
          event.type === "agent_reasoning" && event.assistant === "coordinator";
        const late = lines.filter((_, index) => isCoordinatorReasoning(events[index]));
        const round = events.find((event) => event.type === "coordinator")?.round ?? 1;
        if (late.length === 0)
          late.push(
            JSON.stringify({
              type: "agent_reasoning",
              agent: "itinerary",
              assistant: "coordinator",
              round,
              episode: 1000,
              index: 0,
              text: "Splitting the trip between the specialists.",
            }),
          );
        const rest = lines.filter((_, index) => !isCoordinatorReasoning(events[index]));
        const last = rest.pop();
        const ordered = [...rest, ...late, last];
        window.__lateReasoning = late.length;
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          async start(controller) {
            for (const line of ordered) {
              if (line === late[0]) await pause(2500);
              controller.enqueue(encoder.encode(`${line}\n`));
              await pause(40);
            }
            controller.close();
          },
        });
        return new Response(body, { status: response.status, headers: response.headers });
      };
      window.__markers = {};
      setInterval(() => {
        document.querySelectorAll(".team-conversation").forEach((list, listIndex) => {
          list
            .querySelectorAll(".team-message:not(.team-message--check)")
            .forEach((item, index) => {
              const key = `${listIndex}:${index}:${item.getAttribute("data-assistant")}`;
              const text = item.querySelector(".team-message__marker")?.textContent ?? "";
              const seen = (window.__markers[key] ??= []);
              if (seen.at(-1) !== text) seen.push(text);
            });
        });
      }, 50);
    }, language);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const notNow = page.getByRole("button", { name: language === "zh" ? "暂不" : "Not now" });
    await notNow.waitFor({ timeout: 5000 }).then(
      () => notNow.click(),
      () => {},
    );
    await page
      .getByRole("textbox", {
        name: language === "zh" ? /AI Trip Planner|消息/ : "Message AI Trip Planner",
      })
      .fill(MESSAGE);
    await page.keyboard.press("Enter");
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.waitForTimeout(500);
    const live = await page.evaluate(() => window.__markers);
    const finalKeys = Object.keys(live);
    const flipped = Object.entries(live).filter(
      ([, seen]) => seen.filter((text) => text !== "").length > 1,
    );
    check(finalKeys.length > 0, `${language}: team messages were observed while streaming`, live);
    check(
      flipped.length === 0,
      `${language}: no team message changes its badge once shown`,
      Object.fromEntries(flipped),
    );
    const coordinator = Object.entries(live).find(([key]) => key.endsWith(":coordinator"));
    check(
      coordinator && coordinator[1].filter(Boolean).join() === MARKERS[language][0],
      `${language}: the Coordinator's only badge is "${MARKERS[language][0]}"`,
      coordinator,
    );
    const markers = await page
      .locator(".team-conversation")
      .last()
      .locator(".team-message:not(.team-message--check)")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.querySelector(".team-message__marker")?.textContent ?? ""),
      );
    check(
      markers.length > 0 && markers.every((text) => MARKERS[language].includes(text)),
      `${language}: every finished message says who decided`,
      markers,
    );
    await page.screenshot({ path: `${OUT}/1440-${language}.png` });
    writeFileSync(`${OUT}/badges-${language}.json`, JSON.stringify(live, null, 2));
    check(errors.length === 0, `${language}: browser has no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error).slice(0, 400));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
