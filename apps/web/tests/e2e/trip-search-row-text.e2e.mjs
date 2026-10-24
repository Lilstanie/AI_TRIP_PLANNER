import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(`output/playwright/trip-search-row-text/${process.env.LABEL ?? "run"}`);
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
const savedAt = "2026-10-05T00:00:00Z";
const trip = (id, destination, start, end, estTotal) => {
  const brief = {
    tripId: id,
    userId: "local",
    destination,
    dates: [start, end],
    groupSize: 2,
    budgetTotal: 3000,
  };
  return {
    id: `trip:${id}`,
    title: `${destination} saved`,
    updatedAt: savedAt,
    conversationIds: [],
    snapshot: {
      version: 3,
      id,
      savedAt,
      draft: {
        destination,
        origin: "",
        start,
        end,
        groupSize: "2",
        budgetTotal: "3000",
        preferences: [],
        nationality: "",
        roomAllocation: "shared",
        minRating: "0",
        freeCancellation: false,
      },
      messages: [],
      input: "",
      plan: {
        tripId: id,
        brief,
        round: 1,
        budgetTotal: 3000,
        estTotal,
        overrunPct: -50,
        sections: [],
      },
    },
  };
};
const catalog = {
  version: 4,
  activeConversationId: "chat",
  conversations: [
    {
      id: "chat",
      title: "Harbour walk",
      renamed: true,
      updatedAt: savedAt,
      messages: [{ role: "user", text: "Harbour walk" }],
      input: "",
    },
  ],
  trips: [
    trip("one", "Sydney", "2030-11-14", "2030-11-17", 1090),
    trip("two", "Sydney", "2030-11-14", "2030-11-17", 1090),
    trip("three", "Melbourne", "2030-12-01", "2030-12-03", 640),
  ],
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
      const label = `${width} ${language}`;
      const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 1000 : 844 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        ({ catalog, language }) => {
          localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
          localStorage.setItem(
            "trip.settings.v1",
            JSON.stringify({
              version: 1,
              travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
              memberships: [],
              assistant: { style: "neutral", memory: true },
              dataMode: "mock",
              appearance: "light",
              language,
              displayCurrency: "AUD",
              updatedAt: "2026-10-05T00:00:00Z",
            }),
          );
        },
        { catalog, language },
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
      await page.locator(".workspace-app").waitFor();
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      if (width === 1440)
        await page
          .locator(".sidebar-nav")
          .getByRole("button", { name: language === "en" ? /^Chats/ : /^聊天/ })
          .click();
      else await page.locator(".phone-tabbar").getByRole("tab").last().click();
      const search = page.getByRole("searchbox");
      await search.waitFor();
      const titleSelector =
        width === 1440 ? ".history-item--trip .history-item__title" : ".trip-card__title";
      const rows = await page.locator(titleSelector).allTextContents();
      const metas = width === 1440 ? [] : await page.locator(".trip-card__meta").allTextContents();
      check(rows.length === 3, `${label}: three trip rows (${JSON.stringify(rows)})`);
      const found = async () => {
        await page.waitForTimeout(150);
        return page.locator(titleSelector).allTextContents();
      };
      const sydney = rows.filter((title) => !/Melbourne|墨尔本/.test(title));
      const melbourne = rows.find((title) => /Melbourne|墨尔本/.test(title));
      for (const title of rows) {
        await search.fill(title);
        const shown = await found();
        check(
          shown.includes(title) && !shown.includes(melbourne === title ? sydney[0] : melbourne),
          `${label}: row title "${title}" finds its trip (${JSON.stringify(shown)})`,
        );
      }
      const numbered = sydney.find((title) => /2$/.test(title));
      await search.fill(`${language === "en" ? "trip" : numbered?.slice(0, 2)} 2`);
      const pick = await found();
      check(
        numbered && pick.length === 1 && pick[0] === numbered,
        `${label}: numbered title "${numbered}" picks one trip (${JSON.stringify(pick)})`,
      );
      if (metas.length) {
        const meta = metas[rows.indexOf(sydney[0])];
        const parts = meta.split(" · ");
        for (const part of parts.slice(1)) {
          await search.fill(part);
          const shown = await found();
          check(
            sydney.every((title) => shown.includes(title)) && !shown.includes(melbourne),
            `${label}: row text "${part}" finds the Sydney trips (${JSON.stringify(shown)})`,
          );
        }
      }
      await search.fill("2030-11-14");
      const iso = await found();
      check(
        iso.length === 2 && !iso.includes(melbourne),
        `${label}: ISO date still finds the Sydney trips`,
      );
      await search.fill("harbour");
      check(
        (
          await page
            .locator(".history-item:not(.history-item--trip) .history-item__title")
            .allTextContents()
        ).includes("Harbour walk") && (await found()).length === 0,
        `${label}: chats search unchanged`,
      );
      await search.fill(rows[0]);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${out}/${width}-${language}.png` });
      check(errors.length === 0, `${label}: no page errors (${errors.join("; ")})`);
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
