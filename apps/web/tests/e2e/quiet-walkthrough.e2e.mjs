import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor, waitUntil } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/quiet-walkthrough",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const savedAt = "2026-10-28T00:00:00Z";
const BASE = process.env.BASE_URL ?? "http://localhost:3115";
const browser = await chromium.launch({ channel: process.env.CHANNEL });
let currentPage;

const REMOVED_TAGS = /Place confirmed|Price needs checking|地点已确认|价格待核实/;
const SENTENCE = /Drag a stop to reorder|拖动停靠点调整顺序/;
const CLEAR = ["rgba(0, 0, 0, 0)", "transparent"];

const COPY = {
  en: {
    ask: "Ask AI",
    nav: ["New trip", "Chats", "Trips", "Calendar"],
    newChat: "New chat",
    trajectory: "Trajectory",
    conversation: "Conversation",
    tips: "Travel tips",
    budgetRows: ["Accommodation", "Transport", "Meals", "Activities"],
  },
  zh: {
    ask: "询问 AI",
    nav: ["新行程", "聊天", "行程", "日历"],
    newChat: "新聊天",
    trajectory: "轨迹",
    conversation: "对话",
    tips: "旅行提示",
    budgetRows: ["住宿", "交通", "餐饮", "活动"],
  },
};
const tipText = (zh) =>
  zh
    ? [
        "圣基尔达码头：评分 4.5 的景点。前往前请确认开放时间。",
        "只在不含服务费时给小费。当地人排队很有礼貌。",
        "保存证件复印件",
        "请查看护照的官方入境要求；要求可能会变。预订前请再确认。",
        "天气温和，晚间偏凉。出发前请查看预报。",
        "第六条不应出现。",
        "第七条不应出现。",
      ]
    : [
        "St. Kilda Pier: Sight candidate rated 4.5 by visitors. Verify opening hours.",
        "Tip generously only where service is not included. Locals queue politely.",
        "Keep copies of your documents",
        "Check official entry rules for your passport; they can change. Verify before booking.",
        "Mild days and cool evenings are typical. Check the forecast before departure.",
        "SIXTH tip that must not appear.",
        "SEVENTH tip that must not appear.",
      ];

try {
  for (const viewport of [
    { width: 1440, height: 1500 },
    { width: 390, height: 844 },
    { width: 1440, height: 1500, zh: true },
  ]) {
    const phone = viewport.width <= 520;
    const zh = Boolean(viewport.zh);
    const copy = COPY[zh ? "zh" : "en"];
    const tag = `${viewport.width}px${zh ? " zh" : ""}`;
    const suffix = `${viewport.width}${zh ? "-zh" : ""}`;
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
      ...(phone ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await context.newPage();
    currentPage = page;
    const pageErrors = [];
    const editRequests = [];
    const chatRequests = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", (dialog) => void dialog.accept());
    page.on("request", (request) => {
      if (request.url().endsWith("/api/trip/preview-edit"))
        editRequests.push(request.postDataJSON());
    });
    await page.route("**/api/chat", (route) => {
      chatRequests.push(route.request().postDataJSON());
      return route.fulfill({ status: 503, json: { error: "Fixture reply failure" } });
    });
    await page.route("**/api/places/details", (route) => {
      const { placeId } = route.request().postDataJSON();
      return route.fulfill({ json: { place: placeFor(placeId.replace(/^stub:/, "")) } });
    });
    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));

    const tripId = `walk-trip-${suffix}`;
    const activity = (name, day, startTime, endTime, extra = {}) => ({
      id: `${name.toLowerCase()}-${suffix}`,
      kind: "activity",
      ...(day === undefined ? {} : { day }),
      ...(startTime ? { startTime, endTime } : {}),
      location: name,
      detail: name,
      placeId: placeFor(name).id,
      ...extra,
    });
    const plan = {
      tripId,
      brief: {
        tripId,
        userId: "local",
        destination: "Sydney",
        dates: ["2030-10-01", "2030-10-04"],
        groupSize: 2,
        budgetTotal: 2000,
      },
      round: 1,
      budgetTotal: 2000,
      estTotal: 400,
      overrunPct: -80,
      sections: [
        {
          id: "itinerary",
          label: "Day plan",
          status: "draft",
          summary: "Sydney visit",
          estCost: 105,
          proposal: {
            agent: "itinerary",
            summary: "Sydney visit",
            items: [
              activity("Alder", 1, "09:00", "10:00", { estCost: 25 }),
              activity("Birch", 1, "11:00", "12:00"),
              activity("Cedar", 1, "13:00", "14:00", { estCost: 40, priceNeedsReview: true }),
              activity("Dune", 2, "09:00", "10:00"),
              activity("Elm", 2, "11:00", "12:00", { estCost: 40 }),
              activity("Fir", undefined),
            ],
            assumptions: [],
            conflictsWith: [],
          },
        },
        {
          id: "transport",
          label: "Transport",
          status: "draft",
          summary: "Flight",
          estCost: 80,
          proposal: {
            agent: "transport",
            summary: "Flight",
            assumptions: [],
            conflictsWith: [],
            items: [
              {
                id: "flight-item",
                kind: "flight",
                detail: "Selected fixture flight",
                day: 1,
                selectionId: "flight-1",
                estCost: 80,
              },
            ],
            flights: [
              {
                id: "flight-1",
                from: "MEL",
                to: "SYD",
                depart: "2030-10-01",
                day: 1,
                passengers: 2,
                selectedId: "flight-selected",
                candidates: [{ id: "flight-selected", carrier: "Selected Air", price: 40 }],
              },
            ],
          },
        },
        {
          id: "accommodation",
          label: "Stay",
          status: "draft",
          summary: "Harbour Inn",
          estCost: 300,
          proposal: {
            agent: "accommodation",
            summary: "Harbour Inn",
            items: [
              {
                id: "stay-item",
                kind: "stay",
                day: 1,
                selectionId: "stay-1",
                detail: "Harbour Inn — Circular Quay; 1 room × 3 nights × A$100.00",
                estCost: 300,
              },
            ],
            assumptions: [],
            conflictsWith: [],
            stays: [
              {
                id: "stay-1",
                city: "Sydney",
                checkIn: "2030-10-01",
                checkOut: "2030-10-04",
                day: 1,
                nights: 3,
                rooms: 1,
                selectedId: "room-1",
                candidates: [
                  {
                    id: "room-1",
                    name: "Harbour Inn",
                    area: "Circular Quay",
                    pricePerNight: 100,
                    rating: 8,
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    plan.sections.push({
      id: "destination-guide",
      label: "Travel tips",
      summary: "Guide fixture",
      status: "draft",
      estCost: 0,
      proposal: {
        agent: "destination-guide",
        summary: "Guide fixture",
        items: tipText(zh).map((detail, index) => ({
          kind: [
            "attraction",
            "customs",
            "safety",
            "entry-health",
            "weather-packing",
            "note",
            "note",
          ][index],
          detail,
          ...(index === 4
            ? {
                packing: zh
                  ? ["外套", "步行鞋", "雨衣"]
                  : ["Layers", "Walking shoes", "Rain jacket"],
              }
            : {}),
        })),
        assumptions: [],
        conflictsWith: [],
      },
    });
    const conversationId = `walk-conversation-${suffix}`;
    const snapshot = {
      version: 4,
      id: conversationId,
      savedAt,
      plan,
      draft: {
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
      },
      messages: [],
      input: "",
    };
    const catalog = {
      version: 4,
      activeConversationId: conversationId,
      activeTripId: tripId,
      conversations: [
        {
          id: conversationId,
          title: "Sydney walk",
          updatedAt: savedAt,
          tripId,
          messages: [],
          input: "",
          snapshot,
        },
      ],
      trips: [
        {
          id: tripId,
          title: "Sydney walk",
          status: "draft",
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
        editorView: "timeline",
      },
    };
    await page.addInitScript(
      ({ catalog, savedAt, zh }) => {
        if (!sessionStorage.getItem("seeded")) {
          sessionStorage.setItem("seeded", "1");
          localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        }
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            language: zh ? "zh" : "en",
            dataMode: "mock",
            travel: { homeCity: "", preferences: [] },
            appearance: "system",
            updatedAt: savedAt,
          }),
        );
      },
      { catalog, savedAt, zh },
    );
    await page.goto(BASE);
    await page.locator(".workspace-app").waitFor();
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    if (phone) {
      await page.getByRole("tab", { name: /^(Mine|我的)$/ }).click();
      await page.locator(".phone-mine .trip-card").filter({ hasText: "Sydney" }).first().click();
      const tripTab = page.getByRole("tab", { name: /^(Trip|行程)$/ });
      if (await tripTab.count()) await tripTab.click();
    } else {
      await page.getByRole("button", { name: /^(Trips|行程)/ }).click();
      await page.locator(".trips-page .trip-card").filter({ hasText: "Sydney" }).first().click();
      const toggle = page.locator(".trip-trigger");
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    }
    await page.locator("section.trip-editor").waitFor({ timeout: 8000 });
    const timeline = page.getByRole("region", { name: /^(Trip timeline|行程时间线)$/ });
    await timeline.waitFor({ timeout: 8000 }).catch(() => undefined);
    if (!(await timeline.count())) {
      await page.screenshot({ path: resolve(out, `setup-${suffix}.png`), fullPage: true });
      check(false, `saved Trip fixture opens at ${tag}`, { errors: pageErrors });
      await context.close();
      continue;
    }

    const plain = (text) => text.replace(/\s+/g, " ").trim();
    const editor = page.locator("section.trip-editor");
    const selectDay = async (day) => {
      await page.locator(`.day-strip__day[data-day="${day}"]`).click();
      await waitUntil(
        async () =>
          (await page.locator('.day-strip__day[aria-selected="true"]').getAttribute("data-day")) ===
          String(day),
        4000,
      );
    };
    const rowOf = (name) => page.locator("li.timeline-stop").filter({ hasText: name }).first();
    const style = (locator, property) =>
      locator.evaluate((node, name) => getComputedStyle(node)[name], property);
    const clear = async (locator, label, states) => {
      const background = await style(locator, "backgroundColor");
      check(CLEAR.includes(background), `${label} has no fill ${states} at ${tag}`, background);
    };
    const top = async (locator) => (await locator.boundingBox())?.y ?? Number.NaN;
    const shot = (name) =>
      page.screenshot({ path: resolve(out, `${name}-${suffix}.png`), fullPage: true });
    const reopen = async () => {
      if (phone) await page.getByRole("tab", { name: /^(Trip|行程)$/ }).click();
      else {
        const toggle = page.locator(".trip-trigger");
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      }
      await editor.waitFor({ state: "visible", timeout: 8000 });
    };
    const ideasChip = timeline.locator("button.timeline-ideas-chip");
    const ideasName = (count) =>
      zh ? `${count} 个备选地点` : `${count} ${count === 1 ? "idea" : "ideas"}`;
    const budget = page.locator(".trip-panel__budget-summary");
    const tips = page.locator(".trip-tips");
    const addButton = page.locator(".timeline-add-stop");

    await selectDay(1);
    await budget.waitFor();
    check(
      (await top(budget)) < (await top(ideasChip)) &&
        (await top(ideasChip)) < (await top(page.locator(".day-strip"))) &&
        (await top(page.locator(".day-strip"))) < (await top(addButton)) &&
        (await top(addButton)) < (await top(tips)),
      `the panel reads budget, ideas chip, days, Add button, Travel tips at ${tag}`,
      [await top(budget), await top(ideasChip), await top(addButton), await top(tips)],
    );

    const summary = budget.locator("summary");
    const folded = plain(await summary.innerText());
    check(!(await budget.evaluate((node) => node.open)), `the budget starts as one line at ${tag}`);
    check(
      folded.includes("/") && /\d+/.test(folded.split("/")[1] ?? ""),
      `the budget line shows the known total over the limit at ${tag}`,
      folded,
    );
    check(
      (await budget.locator(".trip__budget strong").count()) === 1,
      `the estimated total is shown once at ${tag}`,
    );
    const unpriced = folded.match(zh ? /(\d+) 项未定价/ : /(\d+) unpriced/);
    check(
      Number(unpriced?.[1]) >= 1,
      `the unpriced count sits beside the budget line at ${tag}`,
      folded,
    );
    check(
      (await budget.getByRole("progressbar").count()) === 1,
      `the budget line has a progress bar at ${tag}`,
    );
    if (phone)
      check(
        ((await summary.boundingBox())?.height ?? 0) >= 44,
        `the budget line is a 44 px target at ${tag}`,
      );
    await summary.click();
    const budgetRows = (
      await budget.locator(".trip-panel__budget-breakdown > li").allInnerTexts()
    ).map(plain);
    check(
      budgetRows.length === 4 &&
        copy.budgetRows.every((label, index) => budgetRows[index].startsWith(label)),
      `tapping the budget lists one row per category at ${tag}`,
      budgetRows,
    );
    check(
      !/Provider (stay|flight|meal)|Selected fixture|Harbour Inn —/.test(
        plain(await budget.innerText()),
      ),
      `the budget carries no provider description at ${tag}`,
    );
    await shot("budget-open");
    await summary.click();
    check(
      !(await budget.evaluate((node) => node.open)),
      `tapping again folds the budget at ${tag}`,
    );

    check(
      (await ideasChip.count()) === 1 && (await ideasChip.innerText()) === ideasName(1),
      `one parked place reads as ${ideasName(1)} at ${tag}`,
      await ideasChip.allInnerTexts(),
    );
    check(
      (await editor.getByRole("heading", { name: /^(Ideas|备选地点)$/ }).count()) === 0,
      `no Ideas section sits above Day 1 at ${tag}`,
    );
    check(
      (await timeline.getByText(/Show distances|显示距离/).count()) === 0 &&
        (await timeline.getByRole("switch").count()) === 0,
      `no Show distances switch at ${tag}`,
    );
    check(
      (await timeline
        .locator(".timeline-connection")
        .getByRole("link", { name: /Directions|路线/ })
        .count()) >= 1,
      `legs show Directions at ${tag}`,
    );
    check(
      (await editor.getByText(REMOVED_TAGS).count()) === 0 &&
        (await rowOf("Alder").locator(".timeline-tag").count()) === 0 &&
        !(await rowOf("Alder").innerText()).match(/Planned|待游览/),
      `stops carry no status tags at ${tag}`,
    );
    check(!(await editor.innerText()).match(SENTENCE), `no drag helper sentence at ${tag}`);
    check(
      (await page.getByRole("button", { name: /Ask AI about|向 AI 咨询/ }).count()) === 0,
      `no full-width Ask AI bar at ${tag}`,
    );
    check(
      (await rowOf("Alder").locator(".timeline-row__cost").innerText()).includes("25"),
      `a priced stop shows its price on the right at ${tag}`,
    );
    const time = rowOf("Alder").locator("button.timeline-stop__time");
    await clear(time, "the time cell", "at rest");
    if (!phone) {
      await time.hover();
      await page.waitForTimeout(500);
      await clear(time, "the time cell", "on hover");
      await page.mouse.move(0, 0);
    }
    await time.click();
    await waitUntil(async () => (await time.getAttribute("aria-expanded")) === "true", 3000);
    await page.waitForTimeout(500);
    await clear(time, "the time cell", "while its popover is open");
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    const flight = timeline.locator(".timeline-fixed--flight .timeline-fixed__icon").first();
    await clear(flight, "the flight icon", "");
    check(
      (await style(flight, "borderTopWidth")) === "0px",
      `the flight icon has no ring at ${tag}`,
    );
    await shot("panel");

    check(!(await tips.evaluate((node) => node.open)), `Travel tips start folded at ${tag}`);
    check(
      plain(await tips.locator("summary").innerText()).includes(copy.tips),
      `the folded row is named ${copy.tips} at ${tag}`,
    );
    await tips.locator("summary").click();
    const tipRows = tips.locator(".trip-tips__list > li");
    const shown = [];
    for (let index = 0; index < (await tipRows.count()); index += 1)
      shown.push(
        plain(await tipRows.nth(index).locator("p:not(.trip-tips__kind)").first().innerText()),
      );
    check(
      shown.length === 5 && !/SIXTH|SEVENTH|第六|第七/.test(shown.join(" ")),
      `at most five tips show at ${tag}`,
      shown,
    );
    check(
      shown.every((text) => !/Verify|预订前请再确认|前往前请确认/.test(text)),
      `each old tip shows only its first sentence at ${tag}`,
      shown,
    );
    await tips.scrollIntoViewIfNeeded();
    await shot("tips-open");
    await tips.locator("summary").click();

    await ideasChip.click();
    const panel = page.getByRole("region", { name: /^(Add to trip|添加到行程)$/ });
    await panel.waitFor();
    check(
      (await panel
        .getByRole("tab", { name: /^(Ideas|备选地点)$/ })
        .getAttribute("aria-selected")) === "true",
      `the chip opens the Add to trip panel on Ideas at ${tag}`,
    );
    await shot("chip-panel");
    await panel.getByRole("button", { name: /^(Close|关闭)$/ }).click();

    const saved = () =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        const found = stored?.trips?.find((trip) => trip.id === stored.activeTripId);
        return (
          found?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal
            ?.items ?? []
        );
      });
    const dayOf = async (name) => (await saved()).find((item) => item.location === name)?.day;
    const cdp = phone ? await context.newCDPSession(page) : undefined;
    const touchSend = (type, x, y) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
      });
    await selectDay(1);
    const handle = rowOf("Alder").locator(".timeline-stop__name").first();
    await handle.scrollIntoViewIfNeeded();
    const from = await handle.boundingBox();
    let pos = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    if (phone) {
      await touchSend("touchStart", pos.x, pos.y);
      await new Promise((done) => setTimeout(done, 700));
    } else {
      await page.mouse.move(pos.x, pos.y);
      await page.mouse.down();
      await page.mouse.move(pos.x, pos.y + 12);
      pos.y += 12;
    }
    await ideasChip.scrollIntoViewIfNeeded().catch(() => undefined);
    const target = await ideasChip.boundingBox();
    const goal = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    for (let step = 1; step <= 8; step += 1) {
      const px = pos.x + ((goal.x - pos.x) * step) / 8;
      const py = pos.y + ((goal.y - pos.y) * step) / 8;
      if (phone) await touchSend("touchMove", px, py);
      else await page.mouse.move(px, py);
    }
    check(
      (await ideasChip.getAttribute("data-drop-target")) === "true",
      `the chip becomes a drop target while a stop is dragged at ${tag}`,
    );
    await shot("chip-target");
    if (phone) await touchSend("touchEnd", 0, 0);
    else await page.mouse.up();
    check(
      await waitUntil(async () => (await dayOf("Alder")) === undefined, 10_000),
      `dropping on the chip parks the stop at ${tag}`,
    );
    check(
      (await ideasChip.innerText()) === ideasName(2),
      `the chip counts two ideas after the drop at ${tag}`,
      await ideasChip.allInnerTexts(),
    );
    await page
      .getByRole("button", { name: /^(Undo( last change)?|撤销|撤销上次修改)$/ })
      .first()
      .click();
    check(
      (await waitUntil(async () => (await dayOf("Alder")) === 1, 10_000)) &&
        (await ideasChip.innerText()) === ideasName(1),
      `Undo puts the stop back and the chip back to one idea at ${tag}`,
    );

    const askItem = () => page.getByRole("menuitem", { name: copy.ask, exact: true });
    const stopMenu = page.getByRole("button", {
      name: zh ? /^Alder，.*的操作$/ : /^Actions for Alder, /,
    });
    await stopMenu.click();
    check(
      (await askItem().count()) === 1 && (await askItem().isEnabled()),
      `the stop menu offers Ask AI at ${tag}`,
    );
    await shot("stop-menu");
    await askItem().click();
    await waitUntil(() => chatRequests.length === 1, 6000);
    await shot("after-ask");
    check(
      chatRequests.at(-1)?.message ===
        (zh
          ? "请结合当前行程，调整第 1 天的 Alder 安排。"
          : "Suggest a change for Alder on Day 1, taking the rest of my current plan into account."),
      `the stop item sends the stop suggestion request at ${tag}`,
      chatRequests.at(-1)?.message,
    );
    check(
      await page.locator(".composer__input").isVisible(),
      `the chat is shown after asking at ${tag}`,
    );
    await reopen();
    await page
      .getByRole("button", { name: zh ? "第 1 天的操作" : "Day 1 actions", exact: true })
      .first()
      .click();
    await shot("day-menu");
    await askItem().click();
    await waitUntil(() => chatRequests.length === 2, 6000);
    check(
      chatRequests.at(-1)?.message ===
        (zh
          ? "请结合当前行程，优化第 1 天的安排。"
          : "Suggest improvements for Day 1, taking the rest of my current plan into account."),
      `the day item sends the day suggestion request at ${tag}`,
      chatRequests.at(-1)?.message,
    );

    if (!phone) {
      const nav = page.locator(".sidebar-nav");
      const order = await nav
        .getByRole("button")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("aria-label") ?? node.textContent.trim()),
        );
      check(
        order.length === 4 && copy.nav.every((name, index) => order[index].startsWith(name)),
        `the sidebar has no plus beside Chats at ${tag}`,
        order,
      );
      await nav.getByRole("button", { name: new RegExp(`^${copy.nav[1]}`) }).click();
      await page.locator(".chats-panel.is-open").waitFor();
      check(
        (await nav.getByRole("button", { name: copy.newChat }).count()) === 0,
        `the open Chats panel adds no New chat row at ${tag}`,
      );
      await shot("sidebar");
      await nav.getByRole("button", { name: new RegExp(`^${copy.nav[1]}`) }).click();

      const tripButton = page.locator(".trip-trigger");
      const seen = () =>
        page.evaluate(() => {
          const visible = (selector) => {
            const node = document.querySelector(selector);
            return Boolean(node && !node.closest("[hidden]") && node.getClientRects().length > 0);
          };
          return {
            trip: visible(".trip-workspace"),
            trajectory: visible("#chat-panel-trajectory"),
            conversation: visible("#chat-panel-conversation"),
            tripButton: document.querySelector(".trip-trigger")?.getAttribute("aria-expanded"),
          };
        });
      const tab = (name) => page.getByRole("tab", { name, exact: true });
      await reopen();
      await tab(copy.trajectory).click();
      await page.waitForTimeout(400);
      let now = await seen();
      check(
        !now.trip && now.trajectory && now.tripButton === "false",
        `Trajectory with Trip open shows Trajectory and closes Trip at ${tag}`,
        now,
      );
      const modebar = await page
        .locator("[data-trajectory-modebar]")
        .first()
        .evaluate((node) => {
          const computed = getComputedStyle(node);
          return {
            blur: /blur/.test(computed.backdropFilter || computed.webkitBackdropFilter || ""),
            fill: computed.backgroundColor,
          };
        });
      check(
        modebar.blur && !CLEAR.includes(modebar.fill),
        `the Trajectory toolbar keeps its glass at ${tag}`,
        modebar,
      );
      await shot("trajectory");
      await reopen();
      await tab(copy.conversation).click();
      await page.waitForTimeout(400);
      now = await seen();
      check(
        !now.trip && now.conversation && now.tripButton === "false",
        `Conversation with Trip open shows the conversation and closes Trip at ${tag}`,
        now,
      );
      await tripButton.click();
      await page.waitForTimeout(400);
      check((await seen()).trip, `the Trip button reopens the panel at ${tag}`);
    } else {
      await page.getByRole("tab", { name: /^(Trip|行程)$/ }).click();
      check(
        (await page.getByRole("tab", { name: "Trajectory", exact: true }).count()) === 0 &&
          (await page.getByRole("tab", { name: "轨迹", exact: true }).count()) === 0,
        `no Trajectory tab appears inside the phone Trip view at ${tag}`,
      );
      await page.getByRole("tab", { name: /^(Mine|我的)$/ }).click();
      check(
        (await page
          .locator(".phone-mine .chats-panel__section-head")
          .getByRole("button", { name: copy.newChat, exact: true })
          .count()) === 1,
        `the phone Mine tab keeps its own New chat at ${tag}`,
      );
    }
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `no sideways page scroll at ${tag}`,
    );
    check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
    await context.close();
  }
} catch (error) {
  check(false, "quiet panel walkthrough completed without an exception", String(error));
  if (currentPage)
    await currentPage
      .screenshot({ path: resolve(out, "exception.png"), fullPage: true })
      .catch(() => undefined);
} finally {
  await browser.close();
  const passed = checks.length > 0 && checks.every((item) => item.ok);
  writeFileSync(resolve(out, "result.json"), JSON.stringify({ passed, checks }, null, 2));
  if (!passed) process.exitCode = 1;
}
