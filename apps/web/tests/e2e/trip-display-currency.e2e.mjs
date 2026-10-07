// Trip display currency (spec #225, tickets #227 and #228). Mock data mode, no model keys: the
// offline extractor reads every message. Run at 1440 px and 390 px; screenshots and a JSON summary
// go to output/playwright/trip-display-currency.
//
// Failure inventory, written before the code. Each line is a way this feature can fail, and the
// check named after it:
// - "Budget 3000 人民币" leaves the plan panel, a trip card or the budget field in AUD (or Settings);
// - "show it in yen" with the budget already stated leaves the trip in CNY, or rewrites the source
//   budget (it must still be 3000 CNY, 630 AUD planning);
// - a currency named alone ("用日元给我算", no budget) is ignored, in a blank chat or after the
//   follow-up message that supplies the rest of the brief;
// - naming AUD while Settings is CNY leaves the trip in CNY, because AUD is taken for "nothing named";
// - naming a currency in chat writes Settings, or changes another trip;
// - a new trip starts in the previous trip's currency instead of the Settings currency;
// - a trip that never named a currency ignores a Settings change, or one that did follows it;
// - Chinese chat with no currency is shown in CNY (a guess from language) instead of Settings;
// - a reload loses the display currency;
// - a trip saved before this change (no displayCurrency) no longer opens, or loses its source
//   budget currency fallback;
// - JPY shows decimals;
// - horizontal page scroll at 390 px, or a page error.
//
// Ticket #228, text the server writes. More ways this can fail:
// - a CNY trip's specialist summaries, thinking transcript, conflict reasons or the assistant's
//   fallback reply still say "AUD" (a hard-coded currency left at any of the ~29 call sites);
// - a summary quotes an amount that differs from the same section's amount on the panel
//   (converted twice, rounded differently, or not grouped like the panel);
// - the tight-budget CNY trip's conflict text or impossible-budget reply names the shortfall or the
//   needed budget in AUD, or the plan fits when it should not (guardrails drifted from AUD);
// - generated text drops the estimate marking a converted amount needs;
// - the request field is required (an older client without it breaks) or accepts an unsupported
//   currency, or an absent field stops meaning AUD;
// - the request's Settings currency outranks the trip's own display currency or source budget on
//   the server (the browser's rule and the server's must be the same);
// - the Settings currency is never sent, so a trip that named none reads AUD on the server while
//   the panel shows Settings (the browser sends it with every request);
// - JPY text shows decimals;
// - a provider fare is converted (fares stay in the provider's currency: asserted by the display-
//   currency and source-budget scripts, and not touched by this change).
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/trip-display-currency");
mkdirSync(out, { recursive: true });
const results = [];
const summary = {};
const check = (ok, name) => {
  results.push({ ok, name });
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
};
const SETTINGS_KEY = "trip.settings.v1";
const CURRENT_KEY = "trip-workspace-v1";
const SYDNEY = "Plan Sydney, 2026-11-10 to 2026-11-13, 2 travellers, Budget 3000 人民币";

// The request field, at the API boundary: optional (an older client sends none), limited to the
// supported currencies, and absent means AUD. The brief's own currency outranks it.
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const apiBrief = {
  tripId: "display-currency-api-e2e",
  destination: "Sydney",
  dates: ["2026-11-10", "2026-11-13"],
  groupSize: 2,
  budgetTotal: 630,
};
const apiPlan = async (extra, brief = apiBrief) => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({
      tripId: brief.tripId,
      message: "Plan it",
      mode: "plan",
      brief,
      ...extra,
    }),
  });
  if (response.status !== 200) return { status: response.status, text: "" };
  const frames = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const done = frames.find((frame) => frame.type === "complete");
  const text = JSON.stringify([
    done?.response.reply,
    done?.response.plan.sections.map((section) => section.summary),
  ]);
  return { status: 200, text };
};
{
  const older = await apiPlan({});
  check(
    older.status === 200 && older.text.includes("AUD") && !older.text.includes("CNY"),
    "API: a request without the field is written in AUD (older client)",
  );
  const cny = await apiPlan({ displayCurrency: "CNY" });
  check(
    cny.status === 200 && cny.text.includes("CNY") && !cny.text.includes("AUD"),
    "API: displayCurrency CNY writes the text in CNY",
  );
  const bad = await apiPlan({ displayCurrency: "XYZ" });
  check(bad.status === 400, `API: an unsupported displayCurrency is rejected (${bad.status})`);
  const own = await apiPlan({ displayCurrency: "CNY" }, { ...apiBrief, displayCurrency: "JPY" });
  check(
    own.status === 200 && own.text.includes("JPY") && !own.text.includes("CNY"),
    "API: the trip's own display currency outranks the request's",
  );
  const source = await apiPlan(
    { displayCurrency: "USD" },
    { ...apiBrief, budgetSource: { amount: 3000, currency: "CNY" } },
  );
  check(
    source.status === 200 && source.text.includes("CNY") && !source.text.includes("USD"),
    "API: the source budget's currency outranks the request's",
  );
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
const hideDevTools = (context) =>
  // The Next.js dev-tools button sits over the phone Chat tab and swallows the tap.
  context.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.append(style);
    }),
  );

try {
  for (const width of [1440, 390]) {
    const phone = width === 390;
    const tag = (name) => `${width}: ${name}`;
    const context = await browser.newContext({
      locale: "en-AU",
      viewport: { width, height: phone ? 844 : 1000 },
    });
    await hideDevTools(context);
    let page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));

    const selectTab = async (name) => {
      await page
        .getByRole("tablist", { name: "Workspace sections" })
        .getByRole("tab", { name: new RegExp(`^${name}`) })
        .click();
      await page.waitForTimeout(400);
    };
    const factsSheet = page.getByRole("dialog", { name: "Trip details", exact: true });
    const openSettings = async () => {
      if (phone) {
        await selectTab("Mine");
        await page
          .locator(".phone-mine")
          .getByRole("button", { name: "Settings & account", exact: true })
          .click();
      } else await page.locator('button[aria-label^="Account settings:"]:visible').first().click();
    };
    const setSettingsCurrency = async (currency) => {
      await openSettings();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("tab", { name: "Language & region" }).click();
      await dialog.getByRole("button", { name: "Change Display currency" }).click();
      await dialog
        .getByRole("group", { name: "Display currency", exact: true })
        .getByRole("button", { name: currency, exact: true })
        .click();
      await page.keyboard.press("Escape");
      if (phone) await selectTab("Chat");
    };
    const settingsCurrency = () =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.displayCurrency ?? "AUD",
        SETTINGS_KEY,
      );
    const storedBrief = () =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.plan?.brief,
        CURRENT_KEY,
      );
    const agentReplies = () => page.locator(".msg-item--agent .msg-item__body").count();
    const composer = page.getByRole("textbox", { name: "Message AI Trip Planner" });
    const send = async (text) => {
      if (phone) await selectTab("Chat");
      // A trip drawer left open on a desktop screen covers the composer.
      const backdrop = page.locator(".workspace-drawer-backdrop");
      if (await backdrop.isVisible()) await backdrop.click({ force: true });
      const before = await agentReplies();
      await composer.fill(text);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.waitForFunction(
        ([count]) => document.querySelectorAll(".msg-item--agent .msg-item__body").length > count,
        [before],
        { timeout: 180000 },
      );
      // The reply lands before the plan is stored; wait for the composer to be usable again.
      await page.getByRole("button", { name: "Send", exact: true }).waitFor({ timeout: 180000 });
      await page.waitForTimeout(600);
    };
    const showTripPanel = async () => {
      if (phone) await page.locator(".phone-tabbar").getByRole("tab", { name: /^Trip/ }).click();
      else if (!(await page.locator(".trip-panel").isVisible()))
        await page.getByRole("button", { name: "Open your trip" }).click();
      await page.locator(".trip__budget strong").waitFor();
    };
    /** What the plan panel shows: the total, each section's cost and the budget line. */
    const panel = async () => {
      await showTripPanel();
      return {
        total: (await page.locator(".trip__budget strong").textContent()).trim(),
        costs: await page.locator(".section__row .cost").allTextContents(),
        budgetLine: (await page.locator(".trip__budget-delta").textContent()).trim(),
      };
    };
    const field = async () => {
      if (phone) {
        await page.locator(".phone-topbar__title-button").click();
        await factsSheet.waitFor();
        await factsSheet.locator('.facts-sheet__row[data-fact="budget"]').click();
      } else await page.getByRole("button", { name: /^Budget/ }).click();
      const label = await page.locator("label", { hasText: "Or enter an amount (" }).textContent();
      await page.keyboard.press("Escape");
      if (phone) {
        if (await factsSheet.isVisible()) await page.keyboard.press("Escape");
        await factsSheet.waitFor({ state: "detached" });
      }
      return label.match(/\((\w{3})\)/)?.[1];
    };
    const showTrips = async () => {
      if (phone) {
        await selectTab("Mine");
        return page.locator(".phone-mine .trip-card");
      }
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Trips/ })
        .click();
      return page.locator(".trips-page .trip-card");
    };
    /** The trip cards' text, then back to the workspace through the open trip's card. */
    const cards = async () => {
      const list = await showTrips();
      await list.first().waitFor();
      const texts = (await list.allTextContents()).map((text) => text.replace(/\s+/g, " "));
      await page.screenshot({ path: `${out}/${width}-trips-${texts.length}.png`, fullPage: true });
      const current = page.locator(".trip-card[aria-current=true]");
      await ((await current.count()) ? current : list).first().click();
      if (phone) await selectTab("Chat");
      return texts;
    };
    const openChat = async (titlePrefix) => {
      if (phone) await selectTab("Mine");
      else await page.getByRole("button", { name: /^Chats/ }).click();
      await page.locator(`.history-item__open[title^="${titlePrefix}"]`).first().click();
      if (phone) await selectTab("Chat");
    };
    const newTrip = async () => {
      if (phone) await selectTab("Mine");
      else await page.getByRole("button", { name: /^Chats/ }).click();
      await page
        .locator(".chats-panel__actions")
        .getByRole("button", { name: "New trip", exact: true })
        .click();
      await page.getByRole("dialog", { name: "Where", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog", { name: "Where", exact: true }).waitFor({ state: "hidden" });
      if (phone) await selectTab("Chat");
    };
    const flat = (text) => text.replace(/\s+/g, " ").trim();
    const lastReply = async () =>
      flat(await page.locator(".msg-item--agent .msg-item__body").last().textContent());
    /** Each section row of the plan panel: label, the specialist's summary and its cost. */
    const sectionRows = async () => {
      await showTripPanel();
      return page.locator(".section__row").evaluateAll((rows) =>
        rows.map((row) => ({
          label: row.querySelector("strong")?.textContent ?? "",
          summary: (row.querySelector("small")?.textContent ?? "").replace(/\s+/g, " ").trim(),
          cost: (row.querySelector(".cost")?.textContent ?? "").replace(/\s+/g, " ").trim(),
        })),
      );
    };
    /** The thinking transcript of the latest turn, every row opened. */
    const thinkingText = async () => {
      if (phone) await selectTab("Chat");
      // A trip drawer left open on a desktop screen covers the chat.
      const backdrop = page.locator(".workspace-drawer-backdrop");
      if (await backdrop.isVisible()) await backdrop.click({ force: true });
      const turn = page.locator(".thinking-process").last();
      const line = turn.locator(".thinking-turn > .thinking-row__line");
      if ((await line.getAttribute("aria-expanded")) !== "true") await line.click();
      for (let pass = 0; pass < 3; pass++) {
        const closed = turn.locator('.thinking-row__line[aria-expanded="false"]');
        const count = await closed.count();
        if (!count) break;
        for (let i = count - 1; i >= 0; i--) await closed.nth(i).click({ force: true });
      }
      return flat(await turn.textContent());
    };
    const storedPlan = () =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.plan, CURRENT_KEY);
    const has = (text, code) => text.includes(code);
    const only = (texts, code) => texts.length > 0 && texts.every((text) => has(text, code));

    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    await page.locator(".workspace-app").waitFor();
    const log = { width };
    summary[width] = log;

    // 1. A budget in CNY, Settings left at AUD.
    check((await settingsCurrency()) === "AUD", tag("Settings starts at AUD"));
    await send(SYDNEY);
    let shown = await panel();
    log.cnyBudget = shown;
    check(
      has(shown.total, "CNY") && only(shown.costs, "CNY"),
      tag(`Budget 3000 人民币 shows the plan panel in CNY (${shown.total})`),
    );
    check((await field()) === "CNY", tag("budget field uses CNY"));
    let texts = await cards();
    check(
      texts.length === 1 && has(texts[0], "CNY") && !has(texts[0], "AUD"),
      tag(`trip card total is CNY (${texts[0]})`),
    );
    check((await settingsCurrency()) === "AUD", tag("Settings unchanged by a CNY budget"));

    // 1b. Text the server wrote for that CNY trip speaks CNY, and agrees with the panel.
    const rows = await sectionRows();
    log.rows = rows;
    check(
      rows.length >= 3 && rows.every((row) => !has(row.summary, "AUD")),
      tag(`no specialist summary says AUD (${rows.map((row) => row.summary).join(" | ")})`),
    );
    check(
      rows.filter((row) => has(row.summary, "CNY")).length >= 2,
      tag("specialist summaries quote amounts in CNY"),
    );
    check(
      rows.some((row) => row.summary.includes(row.cost)) &&
        rows
          .filter((row) => has(row.summary, "CNY"))
          .every((row) => /CNY [\d,]+\.\d\d/.test(row.summary)),
      tag(`a summary's amount is the panel's amount (${rows.map((r) => r.cost).join(", ")})`),
    );
    const reply1 = await lastReply();
    log.reply = reply1;
    check(!has(reply1, "AUD"), tag(`the assistant's reply says no AUD (${reply1.slice(0, 160)})`));
    const thinking1 = await thinkingText();
    log.thinking = thinking1.slice(0, 600);
    check(thinking1.length > 40, tag("the thinking transcript opens and has text"));
    check(
      !has(thinking1, "AUD") && has(thinking1, "CNY"),
      tag("the thinking transcript quotes amounts in CNY, none in AUD"),
    );
    check(
      (await storedPlan()).brief.budgetTotal === 630,
      tag("planning stays AUD: the stored budget is still 630"),
    );
    let brief = await storedBrief();
    check(brief.displayCurrency === "CNY", tag("brief records display currency CNY"));
    const legacy = await page.evaluate((key) => localStorage.getItem(key), CURRENT_KEY);

    // 2. "show it in yen" switches the trip; the source budget stays.
    await send("show it in yen");
    shown = await panel();
    log.yen = shown;
    check(
      has(shown.total, "JPY") && only(shown.costs, "JPY"),
      tag(`a later "show it in yen" switches the plan panel to JPY (${shown.total})`),
    );
    check(!/\.\d/.test(shown.total), tag("JPY total has no decimals"));
    check((await field()) === "JPY", tag("budget field switches to JPY"));
    texts = await cards();
    check(has(texts[0], "JPY"), tag(`trip card total switches to JPY (${texts[0]})`));
    brief = await storedBrief();
    log.yenBrief = brief;
    check(
      brief.displayCurrency === "JPY" &&
        brief.budgetSource?.amount === 3000 &&
        brief.budgetSource?.currency === "CNY" &&
        brief.budgetTotal === 630,
      tag("source budget still reads 3000 CNY (630 AUD planning)"),
    );
    const yenRows = await sectionRows();
    check(
      yenRows.every((row) => !has(row.summary, "AUD") && !has(row.summary, "CNY")) &&
        yenRows.some((row) => has(row.summary, "JPY")),
      tag(`summaries follow the switch to JPY (${yenRows.map((row) => row.summary).join(" | ")})`),
    );
    check(
      yenRows.every((row) => !/JPY [\d,]+\.\d/.test(row.summary)),
      tag("JPY text has no decimals"),
    );
    await page.screenshot({ path: `${out}/${width}-yen.png`, fullPage: true });

    // 3. AUD is a choice like any other, while Settings is CNY.
    await setSettingsCurrency("CNY");
    check(
      has((await panel()).total, "JPY"),
      tag("a Settings change leaves a trip that named a currency alone"),
    );
    await send("actually show it in AUD");
    shown = await panel();
    log.aud = shown;
    check(
      has(shown.total, "AUD") && !has(shown.total, "CNY") && only(shown.costs, "AUD"),
      tag(`naming AUD switches the trip to AUD while Settings is CNY (${shown.total})`),
    );
    check((await field()) === "AUD", tag("budget field uses AUD"));
    check((await settingsCurrency()) === "CNY", tag("Settings still CNY after naming AUD"));
    await page.screenshot({ path: `${out}/${width}-aud.png`, fullPage: true });

    // 4. A currency named alone, in a blank trip; a new trip starts in Settings.
    await newTrip();
    check((await field()) === "CNY", tag("a new trip starts in the Settings currency (CNY)"));
    await send("用日元给我算");
    check((await field()) === "JPY", tag("a currency named alone sets the blank trip's currency"));
    check(
      (await settingsCurrency()) === "CNY",
      tag("Settings unchanged by a currency named alone"),
    );
    await send("去东京旅行，2026-12-01到2026-12-04，2人，预算4000");
    shown = await panel();
    log.tokyo = shown;
    check(
      has(shown.total, "JPY") && only(shown.costs, "JPY") && !/\.\d/.test(shown.total),
      tag(`the currency named alone survives the follow-up message (${shown.total})`),
    );
    brief = await storedBrief();
    check(
      brief.displayCurrency === "JPY" && brief.budgetSource === undefined,
      tag("brief holds JPY with no source budget"),
    );

    // 5. Chinese chat with no currency shows Settings, not CNY by language.
    await setSettingsCurrency("USD");
    await newTrip();
    await send("去悉尼旅行，2026-11-10到2026-11-13，2人，预算3000");
    shown = await panel();
    log.chinese = shown;
    check(
      has(shown.total, "USD") && !has(shown.total, "CNY"),
      tag(`Chinese chat with no currency shows Settings USD (${shown.total})`),
    );
    brief = await storedBrief();
    check(brief.displayCurrency === undefined, tag("no currency named, so none recorded"));

    // 6. Only the trip that never named a currency follows Settings.
    await setSettingsCurrency("CNY");
    shown = await panel();
    check(
      has(shown.total, "CNY"),
      tag(`a trip that never named a currency follows Settings (${shown.total})`),
    );
    texts = await cards();
    log.cards = texts;
    check(
      texts.length === 3 &&
        texts.some((text) => has(text, "东京") && has(text, "JPY")) &&
        texts.filter((text) => has(text, "AUD")).length === 1 &&
        texts.filter((text) => has(text, "CNY")).length === 1,
      tag(`each trip card keeps its own currency: ${texts.join(" | ")}`),
    );
    check((await settingsCurrency()) === "CNY", tag("Settings is only what the traveller chose"));

    // 7. The currency survives a reload.
    await page.reload();
    await page.locator(".workspace-app").waitFor();
    texts = await cards();
    check(
      texts.length === 3 &&
        texts.some((text) => has(text, "东京") && has(text, "JPY")) &&
        texts.filter((text) => has(text, "AUD")).length === 1,
      tag(`reload keeps every trip's currency: ${texts.join(" | ")}`),
    );
    await openChat("Plan Sydney");
    check(has((await panel()).total, "AUD"), tag("the reopened first trip is still AUD"));

    // 9. A tight budget in CNY: the conflict and the impossible-budget reply name CNY amounts.
    await setSettingsCurrency("AUD");
    await newTrip();
    await send("Plan Sydney, 2026-11-10 to 2026-11-13, 2 travellers, Budget 300 人民币");
    const tight = await storedPlan();
    const tightReply = await lastReply();
    const tightText = JSON.stringify(tight.conflicts ?? []);
    log.tight = { reply: tightReply, conflicts: tight.conflicts };
    check(
      tight.conflicts?.length > 0,
      tag("a 300 CNY budget leaves a conflict (guardrails still AUD)"),
    );
    check(
      tight.brief.budgetTotal === 63 &&
        tight.conflicts.some((c) => c.reason.startsWith("infeasible budget")),
      tag("the 300 CNY budget is 63 AUD and infeasible"),
    );
    check(
      !has(tightText, "AUD") && has(tightText, "CNY"),
      tag(`conflict reason and constraints name CNY, not AUD (${tightText.slice(0, 200)})`),
    );
    check(
      has(tightReply, "CNY") &&
        !has(tightReply, "AUD") &&
        /raise the budget to at least CNY [\d,]+/.test(tightReply),
      tag(`the impossible-budget reply names the shortfall in CNY (${tightReply.slice(0, 200)})`),
    );
    check(
      /above your CNY 300(\.00)? budget/.test(tightReply),
      tag("the reply quotes the 300 CNY budget as the traveller said it"),
    );
    check(
      /(estimate|approximate)/i.test(tightReply),
      tag("generated text marks converted amounts as estimates"),
    );
    check((await settingsCurrency()) === "AUD", tag("Settings stays AUD after a tight CNY trip"));
    const tightThinking = await thinkingText();
    check(!has(tightThinking, "AUD"), tag("the tight trip's thinking transcript says no AUD"));

    // 10. The Settings currency reaches the server: a trip that never named a currency is
    //     written in it, the same currency the panel shows.
    await setSettingsCurrency("USD");
    await newTrip();
    await send("去悉尼旅行，2026-11-10到2026-11-13，2人，预算3000");
    const usdRows = await sectionRows();
    check(
      usdRows.some((row) => has(row.summary, "USD")) &&
        usdRows.every((row) => !has(row.summary, "AUD")),
      tag(
        `a trip with no named currency is written in Settings USD (${usdRows.map((row) => row.summary).join(" | ")})`,
      ),
    );
    check(!has(await lastReply(), "AUD"), tag("and its reply does not say AUD"));

    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      tag("no horizontal page scroll"),
    );
    check(errors.length === 0, tag(`no page errors ${errors.join(" | ")}`));
    await page.screenshot({ path: `${out}/${width}-final.png`, fullPage: true });
    await context.close();

    // 8. A trip saved before this change has no display currency: it opens in its source
    //    budget's currency, and Settings stays AUD.
    const old = JSON.parse(legacy);
    delete old.plan.brief.displayCurrency;
    delete old.draft.displayCurrency;
    const oldContext = await browser.newContext({
      locale: "en-AU",
      viewport: { width, height: phone ? 844 : 1000 },
    });
    await hideDevTools(oldContext);
    await oldContext.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem("seeded")) {
          sessionStorage.setItem("seeded", "1");
          localStorage.setItem(key, value);
        }
      },
      [CURRENT_KEY, JSON.stringify(old)],
    );
    page = await oldContext.newPage();
    const oldErrors = [];
    page.on("pageerror", (e) => oldErrors.push(String(e)));
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    await page.locator(".workspace-app").waitFor();
    check((await settingsCurrency()) === "AUD", tag("legacy trip: Settings is AUD"));
    // Storage never reopens a trip by itself; the saved one waits in the trip list.
    const [saved] = await cards();
    check(saved?.includes("CNY"), tag(`legacy trip card reads in its source currency (${saved})`));
    const oldTotal = (await panel()).total;
    log.legacy = oldTotal;
    check(
      oldTotal.includes("CNY"),
      tag(`a trip saved before the change opens in its source currency (${oldTotal})`),
    );
    await page.screenshot({ path: `${out}/${width}-legacy.png`, fullPage: true });
    check(
      oldErrors.length === 0,
      tag(`legacy trip opens without page errors ${oldErrors.join(" | ")}`),
    );
    await oldContext.close();
  }
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
  writeFileSync(`${out}/summary.json`, JSON.stringify({ results, observed: summary }, null, 2));
}
if (results.some((x) => !x.ok)) process.exit(1);
