import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/short-travel-tips", process.env.LABEL ?? "after");
mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (ok, name, observed) => {
  checks.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const plain = (text) => text.replace(/\s+/g, " ").trim();
const savedAt = new Date(0).toISOString();

const activity = (id, location, day, startTime, endTime) => ({
  id,
  kind: "activity",
  ...(day === undefined ? {} : { day, startTime, endTime }),
  location,
  detail: location,
});
const tip = (kind, detail, packing) => ({ kind, detail, ...(packing ? { packing } : {}) });
const EN = {
  attraction: "St. Kilda Pier: Sight candidate rated 4.5 by visitors. Verify opening hours.",
  customs: "Tip generously only where service is not included. Locals queue politely.",
  safety: "Keep copies of your documents",
  entry: "Check official entry rules for your passport; they can change. Verify before booking.",
  weather: "Mild days and cool evenings are typical. Check the forecast before departure.",
  note: "SIXTH tip that must not appear. It is cut.",
  seventh: "SEVENTH tip that must not appear.",
  packing: ["Layers", "Walking shoes", "Rain jacket"],
};
const ZH = {
  attraction: "圣基尔达码头：评分 4.5 的景点。前往前请确认开放时间。",
  customs: "只在不含服务费时给小费。当地人排队很有礼貌。",
  safety: "保存证件复印件",
  entry: "请查看护照的官方入境要求；要求可能会变。预订前请再确认。",
  weather: "天气温和，晚间偏凉。出发前请查看预报。",
  note: "第六条不应出现。它被截掉了。",
  seventh: "第七条不应出现。",
  packing: ["外套", "步行鞋", "雨衣"],
};
const EXPECT = {
  en: {
    texts: [
      "St. Kilda Pier: Sight candidate rated 4.5 by visitors.",
      "Tip generously only where service is not included.",
      "Keep copies of your documents",
      "Check official entry rules for your passport; they can change.",
      "Mild days and cool evenings are typical.",
    ],
    packing: "Layers, Walking shoes, Rain jacket",
  },
  zh: {
    texts: [
      "圣基尔达码头：评分 4.5 的景点。",
      "只在不含服务费时给小费。",
      "保存证件复印件",
      "请查看护照的官方入境要求；要求可能会变。",
      "天气温和，晚间偏凉。",
    ],
    packing: "外套、步行鞋、雨衣",
  },
};

function guideItems(scenario, copy) {
  if (scenario === "no-tips") return undefined;
  if (scenario === "empty-tips") return [];
  return [
    tip("attraction", copy.attraction),
    tip("customs", copy.customs),
    tip("safety", copy.safety),
    tip("entry-health", copy.entry),
    tip("weather-packing", copy.weather, copy.packing),
    tip("note", copy.note),
    tip("note", copy.seventh),
  ];
}

function fixture(scenario, language) {
  const copy = language === "zh" ? ZH : EN;
  const tripId = `short-tips-${scenario}-${language}`;
  const guide = guideItems(scenario, copy);
  const plan = {
    tripId,
    brief: {
      tripId,
      userId: "e2e",
      destination: "Sydney",
      dates: ["2030-12-16", "2030-12-18"],
      groupSize: 2,
      budgetTotal: 800,
    },
    round: 1,
    budgetTotal: 800,
    estTotal: 180,
    overrunPct: 0,
    sections: [
      {
        id: "itinerary",
        label: "Day plan",
        summary: "Itinerary fixture",
        status: "draft",
        estCost: 180,
        proposal: {
          agent: "itinerary",
          summary: "Itinerary fixture",
          items: [
            { ...activity("a1", "Alder", 1, "09:00", "10:00"), estCost: 180 },
            activity("a2", "Birch", 1, "11:00", "12:00"),
            activity("i1", "Fir"),
            activity("i2", "Gum"),
          ],
          assumptions: [],
          conflictsWith: [],
        },
      },
      ...(guide
        ? [
            {
              id: "destination-guide",
              label: "Travel tips",
              summary: "Guide fixture",
              status: "draft",
              estCost: 0,
              proposal: {
                agent: "destination-guide",
                summary: "Guide fixture",
                items: guide,
                assumptions: [],
                conflictsWith: [],
              },
            },
          ]
        : []),
    ],
    conflicts: [],
  };
  const snapshot = {
    version: 4,
    id: tripId,
    savedAt,
    plan,
    draft: {
      destination: "Sydney",
      origin: "",
      start: plan.brief.dates[0],
      end: plan.brief.dates[1],
      groupSize: "2",
      budgetTotal: "800",
      preferences: [],
      nationality: "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages: [
      { role: "user", text: "Create a mock trip." },
      { role: "agent", text: "Ready." },
    ],
    input: "",
  };
  const conversationId = `conversation:${tripId}`;
  const storedTripId = `trip:${tripId}`;
  return {
    tripId,
    catalog: {
      version: 4,
      activeConversationId: conversationId,
      activeTripId: storedTripId,
      conversations: [
        {
          id: conversationId,
          title: "Sydney tips fixture",
          updatedAt: savedAt,
          tripId: storedTripId,
          messages: snapshot.messages,
          input: "",
          snapshot,
        },
      ],
      trips: [
        {
          id: storedTripId,
          title: "Sydney tips fixture",
          updatedAt: savedAt,
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
    },
    settings: {
      version: 1,
      travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
      memberships: [],
      assistant: { style: "neutral", memory: true },
      dataMode: "mock",
      appearance: "system",
      language,
      displayCurrency: "AUD",
      updatedAt: savedAt,
    },
  };
}

const oneSentence = (text) => !/[.!?。！？]\s*\S/.test(text.replace(/\d\.\d/g, "0"));
async function planFresh(name, dates, destination) {
  const brief = {
    tripId: `short-tips-${name}`,
    userId: "short-travel-tips",
    destination,
    dates,
    groupSize: 2,
    budgetTotal: 3000,
  };
  const response = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({ tripId: brief.tripId, mode: "plan", message: "Update trip", brief }),
  });
  const body = await response.text();
  writeFileSync(resolve(OUT, `fresh-${name}.ndjson`), body);
  const terminal = body
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .at(-1);
  check(response.ok && terminal?.type === "complete", `fresh ${name}: mock plan completes`);
  return terminal?.response?.plan?.sections?.find((section) => section.id === "destination-guide")
    ?.proposal;
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
let page;
try {
  for (const [name, dates] of [
    ["same-month", ["2030-12-01", "2030-12-04"]],
    ["cross-month", ["2030-12-28", "2031-01-03"]],
  ]) {
    const guide = await planFresh(name, dates, "Sydney");
    const items = guide?.items ?? [];
    check(items.length > 0 && items.length <= 5, `fresh ${name}: at most five tips`, items.length);
    check(
      items.every((item) => oneSentence(item.detail)),
      `fresh ${name}: every stored tip is one sentence`,
      items.map((item) => item.detail),
    );
    const packing = items.find((item) => item.kind === "weather-packing")?.packing ?? [];
    check(packing.length >= 1 && packing.length <= 4, `fresh ${name}: packing is short`, packing);
    check(
      (guide?.assumptions ?? []).some((line) => /official government sources/.test(line)),
      `fresh ${name}: the verify-with-official-sources caution is kept`,
    );
    if (name === "cross-month")
      check(
        ["weather-packing", "safety", "entry-health"].every((kind) =>
          /December 2030 only/.test(items.find((item) => item.kind === kind)?.detail ?? ""),
        ),
        "fresh cross-month: first-month scope stays on weather, safety and entry tips",
      );
  }

  for (const width of [1440, 390]) {
    for (const language of ["en", "zh"]) {
      const zh = language === "zh";
      for (const scenario of ["old-long", "no-tips", "empty-tips"]) {
        const tag = `${scenario}-${width}-${language}`;
        const { catalog, settings, tripId } = fixture(scenario, language);
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          reducedMotion: "reduce",
        });
        page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await page.addInitScript(
          ({ catalog, settings }) => {
            localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
            localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
          },
          { catalog, settings },
        );
        const openTrip = async () => {
          await page.goto(BASE, { waitUntil: "domcontentloaded" });
          await page.locator(".workspace-app").waitFor();
          const history = page.locator('.history-item__open[title="Sydney tips fixture"]');
          if (width === 390)
            await page.getByRole("tab", { name: zh ? "我的" : "Mine", exact: true }).click();
          else await page.getByRole("button", { name: zh ? /^聊天/ : /^Chats/ }).click();
          await history.click();
          if (width === 390) await page.getByRole("tab", { name: zh ? /^行程/ : /^Trip/ }).click();
          else if (!(await page.locator(".trip-panel__budget-summary").isVisible()))
            await page
              .getByRole("button", { name: zh ? "打开你的行程" : "Open your trip", exact: true })
              .click();
          await page.locator(".trip-panel__budget-summary").waitFor();
        };
        await openTrip();
        const tips = page.locator(".trip-tips");
        const budget = page.locator(".trip-panel__budget-summary");
        const chip = page.locator("button.timeline-ideas-chip");
        const days = page.locator(".day-strip");
        const top = async (locator) => (await locator.boundingBox())?.y ?? Number.NaN;

        if (scenario !== "old-long") {
          check((await tips.count()) === 0, `${tag}: no Travel tips row`);
          check(
            (await page.locator(".trip-tips__list").count()) === 0 &&
              !(await page.locator("body").innerText()).includes(zh ? "出行贴士" : "Travel tips"),
            `${tag}: no heading or gap is left behind`,
          );
          check(
            (await top(budget)) < (await top(chip)) && (await top(chip)) < (await top(days)),
            `${tag}: budget, ideas chip and days still in order`,
          );
          check(errors.length === 0, `${tag}: no page errors`, errors);
          await page.screenshot({ path: resolve(OUT, `${tag}.png`), fullPage: true });
          await context.close();
          continue;
        }

        await tips.waitFor();
        const summary = tips.locator("summary");
        const addButton = page.locator(".timeline-add-stop");
        check(
          (await top(budget)) < (await top(chip)) &&
            (await top(chip)) < (await top(days)) &&
            (await top(days)) < (await top(addButton)) &&
            (await top(addButton)) < (await top(tips)),
          `${tag}: order is budget, ideas chip, days, Travel tips`,
          [await top(budget), await top(chip), await top(days), await top(tips)],
        );
        check(!(await tips.evaluate((node) => node.open)), `${tag}: Travel tips start folded`);
        if (width === 390)
          check(
            ((await summary.boundingBox())?.height ?? 0) >= 44,
            `${tag}: the folded row is a 44 px target`,
          );
        await page.screenshot({ path: resolve(OUT, `${tag}-folded.png`), fullPage: true });
        await summary.click();
        check(await tips.evaluate((node) => node.open), `${tag}: tapping opens the tips`);
        const rows = tips.locator(".trip-tips__list > li");
        check((await rows.count()) === 5, `${tag}: five tips shown out of seven saved`, {
          shown: await rows.count(),
        });
        const shown = [];
        for (let index = 0; index < (await rows.count()); index += 1)
          shown.push(
            plain(await rows.nth(index).locator("p:not(.trip-tips__kind)").first().innerText()),
          );
        const want = EXPECT[language].texts;
        check(
          shown.length === want.length && want.every((text, index) => shown[index] === text),
          `${tag}: each tip is its first sentence, in saved order`,
          shown,
        );
        const bodyText = await tips.innerText();
        check(!/SIXTH|SEVENTH|第六|第七/.test(bodyText), `${tag}: tips six and seven are absent`);
        check(
          !bodyText.includes(zh ? "预订前请再确认" : "Verify before booking") &&
            !bodyText.includes(zh ? "前往前请确认开放时间" : "Verify opening hours"),
          `${tag}: later sentences are not shown`,
        );
        const packing = await tips.locator(".trip-tips__packing").allInnerTexts();
        check(
          packing.length === 1 &&
            plain(packing[0]) === EXPECT[language].packing &&
            (await tips.locator("ul ul, li li").count()) === 0,
          `${tag}: packing is one short ${zh ? "enumerated" : "comma-separated"} line`,
          packing,
        );
        check(
          (await page.evaluate(() => document.documentElement.scrollWidth)) <= width &&
            errors.length === 0,
          `${tag}: no sideways scroll or page errors`,
          errors,
        );
        await tips.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(OUT, `${tag}-open.png`), fullPage: true });

        const stored = await page.evaluate(
          (key) => localStorage.getItem(key),
          `trip-tips-folded:${tripId}`,
        );
        check(stored === "0", `${tag}: the open choice is saved for this trip`, stored);
        await openTrip();
        check(
          await page.locator(".trip-tips").evaluate((node) => node.open),
          `${tag}: the open preference survives a reload`,
        );
        await page.locator(".trip-tips summary").click();
        check(
          !(await page.locator(".trip-tips").evaluate((node) => node.open)) &&
            (await page.evaluate(
              (key) => localStorage.getItem(key),
              `trip-tips-folded:${tripId}`,
            )) === "1",
          `${tag}: folding again is saved`,
        );
        await openTrip();
        check(
          !(await page.locator(".trip-tips").evaluate((node) => node.open)) &&
            (await page.evaluate(
              (key) => localStorage.getItem(key),
              `trip-tips-folded:short-tips-other-${language}`,
            )) === null,
          `${tag}: the folded preference survives a reload and stays with its trip`,
        );
        await context.close();
      }
    }
  }
} catch (error) {
  if (page) {
    writeFileSync(
      resolve(OUT, "failure-state.txt"),
      `${page.url()}\n${await page
        .locator("body")
        .innerText()
        .catch(() => "")}`,
    );
    await page.screenshot({ path: resolve(OUT, "failure.png"), fullPage: true }).catch(() => {});
  }
  check(false, "short travel tips journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(resolve(OUT, "summary.json"), JSON.stringify(checks, null, 2));
}
process.exitCode = checks.some((entry) => !entry.ok) ? 1 : 0;
