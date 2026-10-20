import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(`output/playwright/sidebar-search-counts/${process.env.LABEL ?? "run"}`);
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
};
const draft = {
  destination: "Sydney",
  origin: "",
  start: "2030-10-01",
  end: "2030-10-04",
  groupSize: "2",
  budgetTotal: "2000",
  preferences: [],
  nationality: "",
  roomAllocation: "shared",
  minRating: "0",
  freeCancellation: false,
};
const plan = {
  tripId: "mine-trip",
  brief: {
    tripId: "mine-trip",
    userId: "local",
    destination: "Sydney",
    dates: [draft.start, draft.end],
    groupSize: 2,
    budgetTotal: 2000,
  },
  round: 1,
  budgetTotal: 2000,
  estTotal: 200,
  overrunPct: -90,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: "Sydney museum",
      estCost: 200,
      proposal: {
        agent: "itinerary",
        summary: "Sydney museum",
        items: [{ id: "mine-stop", kind: "activity", detail: "Sydney museum", estCost: 200 }],
        assumptions: [],
        conflictsWith: [],
      },
    },
  ],
};
const savedAt = "2026-10-05T00:00:00Z";
const catalog = {
  version: 4,
  activeConversationId: "alpha",
  conversations: ["alpha", "beta"].map((id) => ({
    id,
    title: `Searchcase ${id}`,
    renamed: true,
    updatedAt: savedAt,
    messages: [{ role: "user", text: `Searchcase ${id}` }],
    input: "",
  })),
  trips: ["alpha", "beta"].map((id) => ({
    id: `trip:${id}`,
    title: `Searchcase ${id}`,
    updatedAt: savedAt,
    conversationIds: [],
    snapshot: {
      version: 3,
      id,
      savedAt,
      draft,
      messages: [],
      input: "",
      plan: { ...plan, tripId: id, brief: { ...plan.brief, tripId: id } },
    },
  })),
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "mine",
    editorView: "map",
  },
};
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const width of [1440, 390]) {
    for (const language of ["en", "zh"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 1000 : 844 },
        reducedMotion: "reduce",
        locale: language === "en" ? "en-AU" : "zh-CN",
      });
      await context.addInitScript(
        ({ catalog }) => {
          localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        },
        { catalog, language },
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
      await page.locator(".workspace-app").waitFor();
      if (width === 1440)
        await page
          .locator(".sidebar-nav")
          .getByRole("button", { name: language === "en" ? /^Chats/ : /^聊天/ })
          .click();
      else await page.locator(".phone-tabbar").getByRole("tab").last().click();
      const search = page.getByRole("searchbox");
      const statuses = page.getByRole("status", {
        name: language === "en" ? /^(Trip|Chat) search results$/ : /^(行程|聊天)搜索结果$/,
      });
      await search.waitFor();
      check((await statuses.count()) === 2, `${width} ${language}: both result regions mounted`);
      for (const [query, count] of [
        ["searchcase alpha", 1],
        ["searchcase", 2],
        ["no-such-entry", 0],
        ["", null],
      ]) {
        await search.fill(query);
        const expected =
          language === "en"
            ? count === null
              ? ["", ""]
              : count === 0
                ? ["No matching trips.", "No matching chats."]
                : [
                    `${count} trip${count === 1 ? "" : "s"} found`,
                    `${count} chat${count === 1 ? "" : "s"} found`,
                  ]
            : count === null
              ? ["", ""]
              : count === 0
                ? ["没有匹配的行程。", "没有匹配的聊天。"]
                : [`找到 ${count} 个行程`, `找到 ${count} 个聊天`];
        await page
          .waitForFunction(
            ({ expected, language }) => {
              const nodes = [...document.querySelectorAll('[role="status"][aria-label]')].filter(
                (node) =>
                  language === "en"
                    ? /^(Trip|Chat) search results$/.test(node.getAttribute("aria-label"))
                    : /^(行程|聊天)搜索结果$/.test(node.getAttribute("aria-label")),
              );
              return (
                nodes.length === 2 && nodes.every((node, i) => node.textContent === expected[i])
              );
            },
            { expected, language },
            { timeout: 3000 },
          )
          .catch(() => {});
        const actual = await statuses.allTextContents();
        check(
          JSON.stringify(actual) === JSON.stringify(expected),
          `${width} ${language} ${count ?? "idle"}: ${JSON.stringify(actual)}`,
        );
        check(
          await statuses.evaluateAll((nodes) =>
            nodes.every((node) => node.getAttribute("aria-live") === "polite"),
          ),
          `${width} ${language} ${count ?? "idle"}: polite status retained`,
        );
        if (count === 1) await page.screenshot({ path: `${out}/${width}-${language}.png` });
      }
      await search.fill("searchcase");
      await page
        .getByRole("button", { name: language === "en" ? "Clear search" : "清除搜索", exact: true })
        .click();
      check(
        await search.evaluate((node) => document.activeElement === node),
        `${width} ${language}: clear returns focus`,
      );
      check(
        await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
        `${width} ${language}: no page overflow`,
      );
      check(errors.length === 0, `${width} ${language}: no page errors (${errors.join("; ")})`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(
    `${out}/summary.json`,
    JSON.stringify({ results, fixture: "local catalog; no live services" }, null, 2),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
