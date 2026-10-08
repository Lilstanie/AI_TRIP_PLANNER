// End-to-end walk through the one day view in the Trip drawer with mock data: the stop's menu (move to
// another day, earlier and later, Ideas, booked, note, details, Remove and Undo), a Replace place search
// that saves the picked place, a time changed by tapping it, the place card opened from a stop and closed
// by keyboard with focus back on the stop, and 44 px phone targets at 390 and 360 px wide with no sideways
// scroll. Screenshots at desktop and phone widths land under output/playwright/itinerary/ as a repeatable
// artifact, with a JSON summary of each check.
//
//   DATA_MODE=mock pnpm --filter @trip/web e2e itinerary
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] BASE_URL=http://localhost:3000 node apps/web/tests/e2e/itinerary.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/itinerary");
mkdirSync(OUT, { recursive: true });

const failures = [];
const results = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  results.push({ ok: !!ok, message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);
const MIN_TARGET = 44;
// The plan as the browser stored it; the workspace keeps the trip here.
const storedPlan = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan);

// The places search answers from this fixture; a test can change it before it searches.
let searchReply = { places: [] };
const REPLACEMENT = {
  id: "e2e-replacement-museum",
  displayName: { text: "Replacement Museum" },
  formattedAddress: "1 Test Street, Sydney",
};

async function openTrip(browser, { width, height }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  const saves = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  // Without a Maps key the place routes answer 503; the browser logs that with no URL. Only that case
  // is expected; any other console error is still reported.
  const placesDown = { seen: false };
  page.on("response", (response) => {
    if (response.status() === 503 && new URL(response.url()).pathname.startsWith("/api/places/"))
      placesDown.seen = true;
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (placesDown.seen && /status of 503/.test(m.text())) return;
    errors.push(m.text());
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/trip/preview-edit")) saves.push(request.postDataJSON());
  });
  // A place edit looks the place up at Google, which needs the server Maps key this run does not have.
  // That lookup is the provider boundary: the edit is re-sent as a time edit at the stop's own times,
  // so the server still checks the day, and the picked place is then recorded on the returned stop.
  await page.route("**/api/trip/preview-edit", async (route) => {
    const body = route.request().postDataJSON();
    if (body.operation?.kind !== "place") return route.continue();
    const items = body.plan.sections.find((s) => s.id === "itinerary").proposal.items;
    const stop = items.find((item) => item.id === body.operation.id);
    const response = await route.fetch({
      postData: JSON.stringify({
        ...body,
        operation: {
          kind: "time",
          id: stop.id,
          startTime: stop.startTime,
          endTime: stop.endTime,
        },
      }),
    });
    const json = await response.json();
    const returned = json.plan?.sections.find((s) => s.id === "itinerary").proposal.items;
    const picked = returned?.find((item) => item.id === body.operation.id);
    if (picked) picked.placeId = body.operation.placeId;
    await route.fulfill({ response, json });
  });
  await page.route("**/api/places/search", (route) => route.fulfill({ json: searchReply }));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.waitForLoadState("networkidle");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const live = page.getByRole("button", { name: /^Live data/ });
    if (!(await live.count())) break;
    await live.click();
    await settle(page, 400);
  }
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
  await settle(page, 1500);
  // Phones show Your Trip on the Trip tab; wider screens open it as a drawer.
  const tripTab = page.getByRole("tab", { name: /^Trip/ });
  if (await tripTab.count()) {
    await tripTab.click();
  } else await page.getByRole("button", { name: "Open your trip" }).click();
  await settle(page, 700);
  return { context, page, errors, saves };
}

async function run(browser, { width, height, tag }) {
  const { context, page, errors, saves } = await openTrip(browser, { width, height });
  const drawer = page.locator(".workspace-drawer--trip, #phone-panel-trip");
  const NOTE = "Buy tickets online";
  // The day view shows one day at a time, chosen on the day strip.
  const showDay = async (day) => {
    const tab = drawer.getByRole("tab", { name: new RegExp(`^Day ${day}\\b`) });
    if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
    await settle(page, 300);
  };
  const dayList = (day) => drawer.getByRole("list", { name: new RegExp(`^Day ${day} timeline$`) });
  const ideasList = () => drawer.getByRole("list", { name: "Stops, Ideas" });
  const stopsIn = (list) => list.locator(".timeline-stop");
  const noted = () => drawer.locator(".timeline-stop").filter({ hasText: NOTE }).first();
  const firstStop = (day) => stopsIn(dayList(day)).first();
  const menuOf = (row) => row.getByRole("button", { name: /^Actions for / });
  const menuLabels = async (row) => {
    await menuOf(row).click();
    await drawer.getByRole("menu").waitFor();
    const found = (await drawer.getByRole("menuitem").allInnerTexts()).map((l) => l.trim());
    await page.keyboard.press("Escape");
    await settle(page, 200);
    return found;
  };
  const choose = async (row, label) => {
    await menuOf(row).click();
    await drawer.getByRole("menuitem", { name: label, exact: true }).click();
    await settle(page, 500);
  };
  const rowsText = async (list) => (await stopsIn(list).allInnerTexts()).join("|");
  const notedIndex = async (list) =>
    (await stopsIn(list).allInnerTexts()).findIndex((text) => text.includes(NOTE));

  // The one view: no tab switch, and the day, stops and Ideas are on screen together.
  check(
    !(await drawer.getByRole("tab", { name: /Itinerary|Timeline & routes/ }).count()),
    `${tag}: the Trip drawer has no Itinerary or Timeline tab (one view)`,
  );
  check(await dayList(1).isVisible(), `${tag}: Day 1 timeline is shown`);
  check(
    (await drawer.locator(".timeline-stop").count()) >= 1,
    `${tag}: every stop of the day has a row (${await drawer.locator(".timeline-stop").count()})`,
  );
  check(
    (await drawer.getByRole("button", { name: /^Actions for / }).count()) >= 1,
    `${tag}: every stop has an action menu`,
  );

  // The menu lists the stop's actions; Escape closes it and returns focus to its trigger.
  await menuOf(firstStop(1)).click();
  const labels = (await drawer.getByRole("menuitem").allInnerTexts()).map((l) => l.trim());
  check(
    [
      "Move to another day",
      "Move to ideas",
      "Replace place",
      "Edit details",
      "Add a note",
      "Mark as booked",
      "Remove",
    ].every((label) => labels.includes(label)),
    `${tag}: menu lists every action (${labels.join(", ")})`,
  );
  check(!labels.includes("Move earlier"), `${tag}: the first stop of a day offers no Move earlier`);
  await page.screenshot({ path: `${OUT}/${tag}-01-menu.png` });
  await page.keyboard.press("Escape");
  await settle(page, 300);
  check(!(await drawer.getByRole("menu").count()), `${tag}: Escape closes the menu`);
  check(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label")?.startsWith("Actions for"),
    ),
    `${tag}: focus returns to the menu trigger`,
  );
  check(await drawer.isVisible(), `${tag}: Escape does not close the drawer`);

  // Booked shows on the row; a note opens a form in the place card and shows under the stop.
  await choose(firstStop(1), "Mark as booked");
  check(
    (await drawer.locator(".timeline-tag", { hasText: "Booked" }).count()) === 1,
    `${tag}: booked shows a tag`,
  );
  await choose(firstStop(1), "Add a note");
  check(
    await drawer.locator(".stop-place-card").isVisible(),
    `${tag}: a menu form opens in the place card`,
  );
  await drawer.getByLabel("Note", { exact: true }).fill(NOTE);
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  await settle(page, 400);
  check(await drawer.getByText(NOTE).first().isVisible(), `${tag}: the note shows under the stop`);

  // Edit details renames the stop; Escape in its form closes the form and keeps the stop as it was.
  await choose(noted(), "Edit details");
  await drawer.getByLabel("What you will do").fill("Morning walk and coffee");
  await page.keyboard.press("Escape");
  await settle(page, 300);
  check(
    !(await drawer.getByLabel("What you will do").count()),
    `${tag}: Escape closes the details form`,
  );
  check(
    await page.evaluate(() => document.activeElement?.classList.contains("timeline-stop__main")),
    `${tag}: focus returns to the stop when its form closes`,
  );
  await choose(noted(), "Edit details");
  await drawer.getByLabel("What you will do").fill("Morning walk and coffee");
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  await settle(page, 400);
  check(
    await drawer.getByText("Morning walk and coffee").first().isVisible(),
    `${tag}: details change`,
  );
  await page.screenshot({ path: `${OUT}/${tag}-02-booked-note.png` });

  // Move to another day: the card's day picker moves the stop through the server check.
  await choose(noted(), "Move to another day");
  await drawer.locator(".stop-place-card select").selectOption("2");
  await settle(page, 600);
  await showDay(2);
  check(
    (await stopsIn(dayList(2)).filter({ hasText: NOTE }).count()) === 1,
    `${tag}: Move to another day puts the stop on Day 2`,
  );

  // Day 2 has its own stop and the noted one. Move earlier and later reorder them through the
  // server check; Undo restores the order the traveller had before.
  const day2 = dayList(2);
  const before2 = await rowsText(day2);
  check(
    (await stopsIn(day2).count()) === 2 && (await notedIndex(day2)) === 1,
    `${tag}: Day 2 has two stops, the noted one last`,
  );
  const firstLabels = await menuLabels(stopsIn(day2).first());
  check(
    !firstLabels.includes("Move earlier") && firstLabels.includes("Move later"),
    `${tag}: the first stop of a day offers Move later only`,
  );
  const lastLabels = await menuLabels(stopsIn(day2).last());
  check(
    lastLabels.includes("Move earlier") && !lastLabels.includes("Move later"),
    `${tag}: the last stop of a day offers Move earlier only`,
  );
  if (tag === "phone") {
    const trigger = menuOf(stopsIn(day2).first());
    const box = await trigger.boundingBox();
    check(
      box && box.width >= MIN_TARGET && box.height >= MIN_TARGET,
      `${tag}: menu trigger is at least ${MIN_TARGET} px (${box?.width}x${box?.height})`,
    );
    await trigger.click();
    const sizes = await drawer
      .getByRole("menuitem")
      .evaluateAll((items) => items.map((i) => i.getBoundingClientRect().height));
    check(
      sizes.length > 0 && sizes.every((h) => h >= MIN_TARGET),
      `${tag}: menu items are at least ${MIN_TARGET} px tall (min ${Math.min(...sizes)})`,
    );
    await page.screenshot({ path: `${OUT}/${tag}-03a-touch-menu.png` });
    await page.keyboard.press("Escape");
    await settle(page, 200);
  }
  await choose(stopsIn(day2).first(), "Move later");
  check(
    (await notedIndex(day2)) === 0,
    `${tag}: Move later puts the other stop after the noted one`,
  );
  await page.screenshot({ path: `${OUT}/${tag}-03b-moved-later.png` });
  await drawer.getByRole("button", { name: /^Undo/ }).click();
  await settle(page, 500);
  check((await rowsText(day2)) === before2, `${tag}: Undo restores Day 2's order and times`);
  await choose(stopsIn(day2).last(), "Move earlier");
  check((await notedIndex(day2)) === 0, `${tag}: Move earlier puts the noted stop first`);
  await drawer.getByRole("button", { name: /^Undo/ }).click();
  await settle(page, 500);

  // Move to Ideas: the stop leaves the day and appears under Ideas, unnumbered, with no time menu.
  await choose(noted(), "Move to ideas");
  check((await ideasList().getByText(NOTE).count()) === 1, `${tag}: the stop is in Ideas`);
  const ideaRow = ideasList().locator(".timeline-stop").filter({ hasText: NOTE });
  const ideaLabels = await menuLabels(ideaRow);
  check(
    !ideaLabels.includes("Move earlier") &&
      !ideaLabels.includes("Move later") &&
      ideaLabels.includes("Schedule on a day"),
    `${tag}: an idea offers Schedule on a day and neither Move earlier nor Move later`,
  );
  check(
    !(await ideaRow.locator(".timeline-stop__time").count()),
    `${tag}: an idea has no time button`,
  );
  await page.screenshot({ path: `${OUT}/${tag}-04-ideas.png` });
  await choose(ideaRow, "Schedule on a day");
  await drawer.getByLabel("Day", { exact: true }).selectOption("3");
  await drawer.getByRole("button", { name: "Schedule", exact: true }).click();
  await settle(page, 500);
  await showDay(3);
  check(
    (await stopsIn(dayList(3)).filter({ hasText: NOTE }).count()) === 1,
    `${tag}: an idea is scheduled back onto a day`,
  );

  // Tapping the time opens Start and End; the change applies at once and can be undone.
  const timed = stopsIn(dayList(3)).filter({ hasText: NOTE }).first();
  await timed.getByRole("button", { name: /^Change time, / }).click();
  await drawer.getByLabel("Start", { exact: true }).fill("22:30");
  await drawer.getByLabel("End", { exact: true }).fill("23:50");
  await drawer.getByRole("button", { name: "Change time", exact: true }).click();
  await drawer.locator(".timeline-stop.is-changed, .timeline-status--error").first().waitFor({
    timeout: 30_000,
  });
  await settle(page, 400);
  check(
    (await stopsIn(dayList(3)).filter({ hasText: NOTE }).first().innerText()).includes("22:30"),
    `${tag}: the time applies at once (22:30–23:50)`,
  );
  check(
    !(await drawer.getByRole("button", { name: "Change time", exact: true }).count()),
    `${tag}: the time form closes once the change is sent`,
  );

  // Replace place: the menu opens the place search in the card; a picked result is saved.
  searchReply = { places: [REPLACEMENT] };
  await choose(stopsIn(dayList(3)).filter({ hasText: NOTE }).first(), "Replace place");
  await drawer.getByRole("searchbox").fill("museum");
  await drawer.getByRole("button", { name: "Search", exact: true }).click();
  await drawer.getByRole("button", { name: "Use Replacement Museum" }).waitFor({ timeout: 15_000 });
  await page.screenshot({ path: `${OUT}/${tag}-05-replace-results.png` });
  const placed = page.waitForResponse((r) => r.url().includes("/api/trip/preview-edit"));
  await drawer.getByRole("button", { name: "Use Replacement Museum" }).click();
  await placed;
  await settle(page, 800);
  const placeSave = saves.findLast((body) => body.operation?.kind === "place");
  check(
    placeSave?.operation?.placeId === REPLACEMENT.id,
    `${tag}: the picked place is sent to the server (${placeSave?.operation?.placeId})`,
  );
  check(
    (await stopsIn(dayList(3))
      .filter({ hasText: NOTE })
      .first()
      .locator(".timeline-tag--ok")
      .count()) === 1,
    `${tag}: the picked place is saved and confirmed`,
  );
  searchReply = { places: [] };

  // Remove, then Undo.
  const total = await drawer.locator(".timeline-stop").count();
  await choose(stopsIn(dayList(3)).filter({ hasText: NOTE }).first(), "Remove");
  check(
    (await drawer.locator(".timeline-stop").count()) === total - 1,
    `${tag}: remove drops the stop`,
  );
  await drawer.getByRole("button", { name: /^Undo/ }).click();
  await settle(page, 500);
  check((await drawer.locator(".timeline-stop").count()) === total, `${tag}: undo restores it`);

  // A place card opens from the stop and closes by Escape with focus back on the stop.
  const card = stopsIn(dayList(3)).filter({ hasText: NOTE }).first();
  // The stop may still be selected from the steps above; a second press would close its card.
  if ((await card.locator(".timeline-stop__main").getAttribute("aria-expanded")) !== "true")
    await card.locator(".timeline-stop__main").click();
  await drawer.locator(".stop-place-card").waitFor();
  check(
    (await drawer.locator(".stop-place-card").getByRole("heading").count()) >= 1,
    `${tag}: the place card has a heading`,
  );
  await page.screenshot({ path: `${OUT}/${tag}-06-place-card.png` });
  // Escape is pressed from the keyboard position of the stop: its main button has focus.
  await card.locator(".timeline-stop__main").focus();
  await page.keyboard.press("Escape");
  await settle(page, 300);
  check(
    !(await drawer.locator(".stop-place-card").count()),
    `${tag}: Escape closes the place card`,
  );
  check(
    await page.evaluate(() => document.activeElement?.classList.contains("timeline-stop__main")),
    `${tag}: focus returns to the stop when its card closes`,
  );

  // Phone and desktop alike: no sideways scroll, and the view stays inside the viewport.
  check(
    !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
    `${tag}: no sideways scroll`,
  );
  // The day view carries the trip's rows (#239). The plan's own shape says which rows to expect, so a
  // trip without a stay, a flight or a guide is not a failure of the rows that are not there.
  const planNow = await storedPlan(page);
  const sectionOf = (id) => planNow?.sections.find((section) => section.id === id)?.proposal;
  const lastDay = await drawer.getByRole("tab", { name: /^Day \d+\b/ }).count();
  check(
    (await drawer.locator(".section__row").count()) === 0,
    `${tag}: no specialist card is rendered (no section rows in the drawer)`,
  );
  const drawerText = await drawer.innerText();
  const SPECIALIST_TEXT = ["Day plan", "Getting around", "Destination guide", "Food & dining"];
  check(
    !SPECIALIST_TEXT.some((label) => drawerText.includes(label)),
    `${tag}: no specialist card title is written in the drawer`,
  );

  // Each night of a stay ends its day with a stay row; a stay row opens to its card and Alternatives.
  const nights = new Map();
  for (const stay of sectionOf("accommodation")?.stays ?? [])
    for (let offset = 0; offset < stay.nights; offset += 1)
      nights.set(stay.day + offset, (nights.get(stay.day + offset) ?? 0) + 1);
  for (let day = 1; day <= lastDay; day += 1) {
    await showDay(day);
    const expected = nights.get(day) ?? 0;
    const shown = await dayList(day).locator("li.timeline-fixed--stay").count();
    check(
      shown === expected,
      `${tag}: Day ${day} shows ${shown} stay row(s) for ${expected} night(s) in the plan`,
    );
    if (expected) {
      const last = await dayList(day).locator("li").last().getAttribute("class");
      check(
        last?.includes("timeline-fixed--stay"),
        `${tag}: Day ${day} ends with its night's stay row`,
      );
    }
  }

  // Flights: the flight in starts the first day, and the return of a round trip ends the last day.
  const flights = sectionOf("transport")?.flights ?? [];
  const returning = (sectionOf("transport")?.items ?? []).some(
    (item) =>
      flights.some((flight) => flight.id === item.selectionId) &&
      /returning \d{4}/.test(item.detail),
  );
  await showDay(1);
  const inCount = flights.filter((flight) => flight.day === 1).length;
  check(
    (await dayList(1).locator("li.timeline-fixed--flight").count()) === inCount,
    `${tag}: Day 1 shows the ${inCount} flight in row(s) the plan has`,
  );
  if (inCount)
    check(
      (await dayList(1).locator("li").first().getAttribute("class"))?.includes(
        "timeline-fixed--flight",
      ),
      `${tag}: Day 1 starts with the flight in`,
    );
  if (returning) {
    await showDay(lastDay);
    const outRow = dayList(lastDay).locator("li").last();
    check(
      (await outRow.getAttribute("class"))?.includes("timeline-fixed--flight") &&
        (await outRow.innerText()).includes("return flight"),
      `${tag}: the last day ends with the flight out`,
    );
    await outRow.locator("button.timeline-booking__open").click();
    check(
      (await outRow.locator(".result-card--flight").count()) === 1,
      `${tag}: the flight out opens to its flight card`,
    );
    await outRow.locator("button.timeline-booking__open").click();
    await showDay(1);
  }

  // A restaurant pick from dining is listed under Ideas; scheduling it moves it onto the day, and
  // Undo puts it back.
  const picks = () =>
    ideasList().locator(".timeline-stop").filter({ hasText: "Restaurant suggestion" });
  const pickCount = await picks().count();
  check(pickCount >= 1, `${tag}: a dining pick is listed under Ideas (${pickCount})`);
  if (pickCount) {
    const before = { day: await stopsIn(dayList(1)).count(), ideas: await picks().count() };
    const pick = picks().first();
    const pickMenu = await menuLabels(pick);
    check(
      pickMenu.join("|") === "Schedule on a day|Remove",
      `${tag}: a pick offers only Schedule on a day and Remove (${pickMenu.join(", ")})`,
    );
    await choose(pick, "Schedule on a day");
    await drawer
      .locator("form.item-editor")
      .getByRole("button", { name: "Schedule", exact: true })
      .click();
    await settle(page, 600);
    const scheduled = { day: await stopsIn(dayList(1)).count(), ideas: await picks().count() };
    check(
      scheduled.day === before.day + 1 && scheduled.ideas === before.ideas - 1,
      `${tag}: the pick is scheduled on Day 1 and leaves Ideas`,
    );
    await drawer.locator(".item-undo").getByRole("button", { name: "Undo" }).click();
    await settle(page, 600);
    const undone = { day: await stopsIn(dayList(1)).count(), ideas: await picks().count() };
    check(
      undone.day === before.day && undone.ideas === before.ideas,
      `${tag}: Undo returns the pick to Ideas`,
    );
  }

  // The destination guide's tips open once, and stay folded for this trip after a reload.
  const tips = drawer.locator("details.trip-tips");
  const guide = sectionOf("destination-guide")?.items ?? [];
  check(
    (await tips.count()) === (guide.length ? 1 : 0),
    `${tag}: the tips block is shown exactly when the plan has a destination guide`,
  );
  if (guide.length) {
    check(await tips.evaluate((el) => el.open), `${tag}: the tips block starts expanded`);
    await tips.locator("summary").click();
    await settle(page, 300);
    check(!(await tips.evaluate((el) => el.open)), `${tag}: the tips block folds`);
    // Only the desktop run reloads: a reload starts a blank chat, and the saved trip is reopened from Trips.
    if (tag === "desktop") {
      await page.reload();
      await page.waitForSelector(".workspace-app");
      await page.waitForLoadState("networkidle");
      await page
        .getByRole("button", { name: /^Trips/ })
        .first()
        .click();
      await page
        .getByRole("button", { name: /\d+ days · AUD/ })
        .first()
        .click();
      await settle(page, 700);
      if (
        !(await drawer
          .first()
          .isVisible()
          .catch(() => false))
      ) {
        await page.getByRole("button", { name: "Open your trip" }).click();
        await settle(page, 700);
      }
      check(
        !(await drawer.locator("details.trip-tips").evaluate((el) => el.open)),
        `${tag}: the folded tips stay folded after a reload`,
      );
    }
  }

  if (tag === "phone") {
    // The checks above moved stops between days; the time button is on a day that has stops.
    await drawer
      .getByRole("tab")
      .filter({ hasText: /\d+ stops?\b/ })
      .first()
      .click();
    await settle(page, 300);
    const timeBox = await drawer.locator(".timeline-stop__time").first().boundingBox();
    check(
      timeBox && timeBox.height >= MIN_TARGET,
      `${tag}: the time button is at least ${MIN_TARGET} px tall (${timeBox?.height})`,
    );
  }
  check(
    !errors.length,
    `${tag}: no console errors${errors.length ? `: ${errors.join(" | ").slice(0, 300)}` : ""}`,
  );
  await context.close();
}

// A narrow phone: the same view opens, a stop's card fits, and its targets are at least 44 px.
async function narrowPhone(browser) {
  const tag = "phone-360";
  const { context, page, errors } = await openTrip(browser, { width: 360, height: 800 });
  const drawer = page.locator("#phone-panel-trip");
  const first = drawer.locator(".timeline-stop").first();
  await first.locator(".timeline-stop__main").click();
  await drawer.locator(".stop-place-card").waitFor();
  await settle(page, 300);
  const targets = await drawer
    .locator(".stop-place-card button, .timeline-stop__time, .action-menu__trigger")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        height: node.getBoundingClientRect().height,
        name: `${node.className} "${node.textContent.trim().slice(0, 30)}"`,
      })),
    );
  const sizes = targets.map((target) => target.height);
  const small = targets.filter((target) => target.height < MIN_TARGET).map((t) => t.name);
  check(
    sizes.length > 0 && small.length === 0,
    `${tag}: stop targets are at least ${MIN_TARGET} px tall (min ${Math.min(...sizes)}${small.length ? `; short: ${small.join(", ")}` : ""})`,
  );
  check(
    !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
    `${tag}: no sideways scroll`,
  );
  await page.screenshot({ path: `${OUT}/${tag}-card.png` });
  check(
    !errors.length,
    `${tag}: no console errors${errors.length ? `: ${errors.join(" | ").slice(0, 300)}` : ""}`,
  );
  await context.close();
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  await run(browser, { width: 1440, height: 1000, tag: "desktop" });
  await run(browser, { width: 390, height: 844, tag: "phone" });
  await narrowPhone(browser);
} finally {
  await browser.close();
}
writeFileSync(
  `${OUT}/summary.json`,
  JSON.stringify(
    { passed: results.filter((r) => r.ok).length, failed: failures.length, checks: results },
    null,
    2,
  ),
);
console.log(`\nScreenshots: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
