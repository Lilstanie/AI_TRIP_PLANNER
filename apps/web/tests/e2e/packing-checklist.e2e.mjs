import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/packing-checklist",
  process.env.LABEL ?? "after",
);
mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (ok, name, observed) => {
  checks.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const savedAt = "2026-10-31T00:00:00Z";

const PACKING = {
  en: ["Layers", "Walking shoes", "Rain jacket"],
  zh: ["外套", "步行鞋", "雨衣"],
};

function trip(key, title, packing) {
  const plan = {
    tripId: key,
    brief: {
      tripId: key,
      userId: "e2e",
      destination: "Sydney",
      dates: ["2030-10-01", "2030-10-03"],
      groupSize: 2,
      budgetTotal: 2000,
    },
    round: 1,
    budgetTotal: 2000,
    estTotal: 0,
    overrunPct: 0,
    sections: [
      {
        id: "destination-guide",
        label: "Travel tips",
        summary: "Guide fixture",
        status: "draft",
        estCost: 0,
        proposal: {
          agent: "destination-guide",
          summary: "Guide fixture",
          items: [
            { kind: "customs", detail: "Locals queue politely." },
            { kind: "weather-packing", detail: "Mild days, cool evenings.", packing },
          ],
          assumptions: [],
          conflictsWith: [],
        },
      },
    ],
    conflicts: [],
  };
  const snapshot = {
    version: 4,
    id: key,
    savedAt,
    plan,
    draft: {
      destination: "Sydney",
      origin: "",
      start: "2030-10-01",
      end: "2030-10-03",
      groupSize: "2",
      budgetTotal: "2000",
      preferences: [],
      nationality: "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages: [
      { role: "user", text: `Plan ${title}.` },
      { role: "agent", text: "Ready." },
    ],
    input: "",
  };
  const conversationId = `conversation:${key}`;
  return {
    conversation: {
      id: conversationId,
      title,
      updatedAt: savedAt,
      tripId: `trip:${key}`,
      messages: snapshot.messages,
      input: "",
      snapshot,
    },
    trip: {
      id: `trip:${key}`,
      title,
      updatedAt: savedAt,
      conversationIds: [conversationId],
      snapshot,
    },
  };
}

function seed(language) {
  const first = trip("packing-first", "Packing first", PACKING[language]);
  const second = trip("packing-second", "Packing second", PACKING[language]);
  return {
    catalog: {
      version: 4,
      activeConversationId: first.conversation.id,
      activeTripId: first.trip.id,
      conversations: [first.conversation, second.conversation],
      trips: [first.trip, second.trip],
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

async function openTrip(page, title, phone, zh) {
  if (phone) await page.getByRole("tab", { name: zh ? "我的" : "Mine", exact: true }).click();
  else await page.getByRole("button", { name: zh ? /^聊天/ : /^Chats/ }).click();
  await page.locator(`.history-item__open[title="${title}"]`).click();
  if (phone) await page.getByRole("tab", { name: zh ? /^行程/ : /^Trip/ }).click();
  else if (!(await page.locator(".trip-tips").isVisible()))
    await page
      .getByRole("button", { name: zh ? "打开你的行程" : "Open your trip", exact: true })
      .click();
  const tips = page.locator(".trip-tips").filter({ visible: true });
  await tips.waitFor();
  if (!(await tips.evaluate((node) => node.open))) await tips.locator("summary").click();
  return tips;
}

const ticked = (tips) =>
  tips
    .getByRole("checkbox")
    .evaluateAll((boxes) =>
      boxes.filter((box) => box.checked).map((box) => box.labels[0]?.innerText.trim()),
    );

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
let page;
try {
  for (const [width, language] of [
    [1440, "en"],
    [390, "zh"],
  ]) {
    const zh = language === "zh";
    const phone = width === 390;
    const items = PACKING[language];
    const tag = `${language}-${width}`;
    const { catalog, settings } = seed(language);
    const context = await browser.newContext({
      viewport: { width, height: phone ? 844 : 1000 },
      reducedMotion: "reduce",
    });
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.addInitScript(
      ({ catalog, settings }) => {
        if (!sessionStorage.getItem("seeded")) {
          sessionStorage.setItem("seeded", "1");
          localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
          localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
        }
      },
      { catalog, settings },
    );
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();

    let tips = await openTrip(page, "Packing first", phone, zh);
    const boxes = tips.getByRole("checkbox");
    check(
      (await boxes.count()) === items.length,
      `${tag}: one checkbox per packing item`,
      await boxes.count(),
    );
    for (const item of items)
      check(
        (await tips.getByRole("checkbox", { name: item, exact: true }).count()) === 1,
        `${tag}: "${item}" names its checkbox`,
      );
    check((await ticked(tips)).length === 0, `${tag}: nothing starts ticked`);

    await tips.getByRole("checkbox", { name: items[0], exact: true }).click();
    await tips.getByRole("checkbox", { name: items[2], exact: true }).focus();
    await page.keyboard.press("Space");
    check(
      JSON.stringify(await ticked(tips)) === JSON.stringify([items[0], items[2]]),
      `${tag}: a click and Space tick their items`,
      await ticked(tips),
    );
    check(await tips.evaluate((node) => node.open), `${tag}: ticking keeps Travel tips open`);
    if (phone) {
      const heights = await tips
        .locator(".trip-tips__check")
        .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
      check(
        heights.length === items.length && heights.every((height) => height >= 44),
        `${tag}: each row is a 44 px touch target`,
        heights,
      );
    }
    await page.screenshot({ path: `${OUT}/${tag}-ticked.png`, fullPage: true });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();
    tips = await openTrip(page, "Packing first", phone, zh);
    check(
      JSON.stringify(await ticked(tips)) === JSON.stringify([items[0], items[2]]),
      `${tag}: ticks survive a reload`,
      await ticked(tips),
    );

    tips = await openTrip(page, "Packing second", phone, zh);
    check(
      (await ticked(tips)).length === 0,
      `${tag}: another Trip with the same items has no ticks`,
      await ticked(tips),
    );

    tips = await openTrip(page, "Packing first", phone, zh);
    await tips.getByRole("checkbox", { name: items[0], exact: true }).click();
    check(
      JSON.stringify(await ticked(tips)) === JSON.stringify([items[2]]),
      `${tag}: unticking clears only that item after switching Trips`,
      await ticked(tips),
    );
    check(errors.length === 0, `${tag}: no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completed", String(error));
  if (page && !page.isClosed())
    await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  const failed = checks.filter((entry) => !entry.ok);
  writeFileSync(
    `${OUT}/summary.json`,
    `${JSON.stringify({ base: BASE, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2)}\n`,
  );
  console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}
