import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const ROOT = resolve(import.meta.dirname, "../../../..");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RUN = process.env.LABEL ?? new Date().toISOString().replaceAll(/[:.]/g, "-");
const OUT = resolve(ROOT, "output/playwright/TP-37", RUN);
mkdirSync(OUT, { recursive: true });
const integration = spawnSync(
  process.execPath,
  [resolve(ROOT, "node_modules/vitest/vitest.mjs"), "run", "tests/weather-packing.e2e.test.ts"],
  {
    cwd: resolve(ROOT, "packages/orchestrator"),
    env: { ...process.env, RUN_ID: RUN },
    encoding: "utf8",
  },
);
writeFileSync(resolve(OUT, "integration.txt"), integration.stdout + integration.stderr);
if (integration.status !== 0)
  throw new Error(`Planning integration failed; see ${OUT}/integration.txt`);
const evidence = resolve(ROOT, "output/e2e/TP-37", RUN);
const stamp = new Date().toISOString();
const catalogFor = (language) => {
  const plan = JSON.parse(
    readFileSync(
      resolve(evidence, `weather-fallback-false${language === "zh" ? "-zh" : ""}.json`),
      "utf8",
    ),
  ).plan;
  plan.estTotal = plan.sections.reduce((sum, section) => sum + (section.estCost ?? 0), 0);
  plan.overrunPct = ((plan.estTotal - plan.budgetTotal) / plan.budgetTotal) * 100;
  writeFileSync(resolve(OUT, `displayed-plan-${language}.json`), JSON.stringify(plan, null, 2));
  const snapshot = {
    version: 4,
    id: plan.tripId,
    savedAt: stamp,
    plan,
    draft: {
      destination: "Tokyo",
      origin: "",
      start: plan.brief.dates[0],
      end: plan.brief.dates[1],
      groupSize: "2",
      budgetTotal: "4000",
      preferences: [],
      nationality: "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages: [
      { role: "user", text: "Help me pack for the weather on my trip dates." },
      { role: "agent", text: "Your plan is ready." },
    ],
    input: "",
  };
  const conversationId = "conversation:weather-dining";
  const tripId = "trip:weather-dining";
  return {
    version: 4,
    activeConversationId: conversationId,
    activeTripId: tripId,
    conversations: [
      {
        id: conversationId,
        title: "Weather and packing",
        updatedAt: stamp,
        tripId,
        messages: snapshot.messages,
        input: "",
        snapshot,
      },
    ],
    trips: [
      {
        id: tripId,
        title: "Weather and packing",
        updatedAt: stamp,
        conversationIds: [conversationId],
        snapshot,
      },
    ],
    layout: {
      sidebar: { collapsed: false },
      preferences: { width: 280 },
      trip: { width: 340 },
      view: "chat",
      editorView: "map",
    },
  };
};
const checks = [];
const check = (ok, name) => {
  checks.push({ name, passed: Boolean(ok) });
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const width of [1440, 390]) {
    for (const language of ["en", "zh"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const catalog = catalogFor(language);
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.addInitScript(
        ({ catalog, language, stamp }) => {
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
              updatedAt: stamp,
            }),
          );
        },
        { catalog, language, stamp },
      );
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.locator(".workspace-app").waitFor();
      if (
        await page
          .getByRole("button", { name: language === "en" ? "Not now" : "暂不", exact: true })
          .isVisible()
      )
        await page
          .getByRole("button", { name: language === "en" ? "Not now" : "暂不", exact: true })
          .click();
      if (width === 390) {
        await page
          .getByRole("tab", { name: language === "en" ? "Mine" : "我的", exact: true })
          .click();
      } else {
        await page.getByRole("button", { name: language === "en" ? /^Chats/ : /^聊天/ }).click();
      }
      await page.locator('.history-item__open[title="Weather and packing"]').click();
      if (width === 390)
        await page.getByRole("tab", { name: language === "en" ? /^Trip/ : /^行程/ }).click();
      else if (!(await page.locator(".trip-tips").isVisible()))
        await page
          .getByRole("button", {
            name: language === "en" ? "Open your trip" : "打开你的行程",
            exact: true,
          })
          .click();
      const tips = page.locator(".trip-tips");
      try {
        await tips.waitFor({ state: "visible" });
      } catch (error) {
        writeFileSync(
          resolve(OUT, `${width}-${language}-failure.txt`),
          await page.locator("body").innerText(),
        );
        await page.screenshot({
          path: resolve(OUT, `${width}-${language}-failure.png`),
          fullPage: true,
        });
        throw error;
      }
      if (!(await tips.evaluate((node) => node.open))) await tips.locator("summary").click();
      const text = await tips.innerText();
      const [lastDay, missingDay, unavailable] =
        language === "zh"
          ? ["6月18日周五", "6月16日周三", "暂无天气数据"]
          : ["Fri, 18 June", "Wed, 16 June", "unavailable"];
      check(
        text.includes(lastDay) && text.includes(missingDay) && text.includes(unavailable),
        `${width}-${language}: dated weather and unavailable day are visible`,
      );
      check(
        language === "en" || !/Wed|Fri|June|forecast|unavailable/.test(text),
        `${width}-${language}: weather day names and labels follow the reply language`,
      );
      check(
        (await page.locator("body").innerText()).split(lastDay).length > 2,
        `${width}-${language}: weather day text matches a day header (${lastDay})`,
      );
      check(
        (await tips.locator(".trip-tips__packing").innerText()).includes("Waterproof jacket"),
        `${width}-${language}: weather-grounded packing renders as a list`,
      );
      await tips.scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(OUT, `${width}-${language}.png`), fullPage: true });
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${width}-${language}: no horizontal overflow`,
      );
      check(errors.length === 0, `${width}-${language}: no page errors (${errors.join("; ")})`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(
    resolve(OUT, "summary.json"),
    JSON.stringify(
      { passed: checks.length === 24 && checks.every((check) => check.passed), checks },
      null,
      2,
    ),
  );
}
if (checks.length !== 24 || checks.some((check) => !check.passed)) process.exitCode = 1;
