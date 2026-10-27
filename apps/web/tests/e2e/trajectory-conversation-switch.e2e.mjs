import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trajectory-conversation-switch", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const savedAt = new Date(0).toISOString();
const messagesOf = (topic) =>
  [1, 2, 3].flatMap((turn) => [
    { role: "user", text: `${topic} question ${turn}` },
    { role: "agent", text: `${topic} answer ${turn}` },
  ]);
const conversation = (id, title) => ({
  id: `conversation:${id}`,
  title,
  updatedAt: savedAt,
  messages: messagesOf(title),
  input: "",
});
const first = conversation("first", "Alpha chat");
const second = conversation("second", "Beta chat");
const catalog = {
  version: 4,
  activeConversationId: first.id,
  conversations: [first, second],
  trips: [],
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "chat",
    editorView: "map",
  },
};
const settings = {
  version: 1,
  travel: { homeCity: "", preferences: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: "system",
  language: "en",
  updatedAt: savedAt,
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
let page;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(
    ({ seed, userSettings }) => {
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed));
      localStorage.setItem("trip.settings.v1", JSON.stringify(userSettings));
    },
    { seed: catalog, userSettings: settings },
  );
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.locator(".workspace-app").waitFor();
  await page.getByRole("tab", { name: "Trajectory", exact: true }).click();
  const simple = page.locator("[data-trajectory-simple]");
  await simple.waitFor();
  const expandedTurns = () =>
    simple
      .locator("[data-simple-turn]")
      .evaluateAll((nodes) =>
        nodes
          .filter(
            (node) =>
              node.querySelector("[data-simple-toggle]")?.getAttribute("aria-expanded") === "true",
          )
          .map((node) => Number(node.getAttribute("data-simple-turn"))),
      );
  const summaries = () => simple.locator("[data-simple-summary]").allInnerTexts();
  check(
    (await summaries()).every((text) => text.startsWith("Alpha chat")) &&
      (await summaries()).length === 3,
    "the first chat lists its three turns",
    await summaries(),
  );
  await simple.locator('[data-simple-turn="2"] [data-simple-toggle]').click();
  check(
    JSON.stringify(await expandedTurns()) === "[2]",
    "the first chat shows its second turn expanded",
    await expandedTurns(),
  );
  await page.getByRole("button", { name: /^Chats/ }).click();
  await page.locator('.history-item__open[title="Beta chat"]').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-simple-summary]")].some((node) =>
      node.textContent?.startsWith("Beta chat"),
    ),
  );
  check(
    (await summaries()).every((text) => text.startsWith("Beta chat")) &&
      (await summaries()).length === 3,
    "the second chat lists its own three turns in the Trajectory tab",
    await summaries(),
  );
  check(
    (await expandedTurns()).length === 0,
    "the second chat opens with every turn collapsed",
    await expandedTurns(),
  );
  await page.screenshot({ path: `${OUT}/second-chat.png` });
  await page.getByRole("button", { name: /^Chats/ }).click();
  await page.locator('.history-item__open[title="Alpha chat"]').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-simple-summary]")].some((node) =>
      node.textContent?.startsWith("Alpha chat"),
    ),
  );
  check(
    (await summaries()).length === 3 && (await expandedTurns()).length === 0,
    "returning to the first chat lists its turns collapsed",
    { summaries: await summaries(), expanded: await expandedTurns() },
  );
  check(errors.length === 0, "browser has no page errors", errors);
  await context.close();
} catch (error) {
  if (page) {
    writeFileSync(
      `${OUT}/failure-state.txt`,
      `${page.url()}\n${await page
        .locator("body")
        .innerText()
        .catch(() => "")}`,
    );
    await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
  }
  check(false, "conversation switch journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((entry) => !entry.ok) ? 1 : 0;
