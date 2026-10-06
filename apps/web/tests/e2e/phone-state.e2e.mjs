// Phone keyboard and navigation (#180, #181). Repeatable screenshots and summary.json are
// written to output/playwright/phone-state. Run against the same mock production server as
// phone-shell.e2e.mjs, with BASE_URL and PLAYWRIGHT overrides when needed.
// Failure inventory, written before implementation:
// - Focusing alone hides the bar even without a keyboard; shortening the viewport without
//   focusing hides navigation; blur leaves the bar hidden.
// - Composer falls behind the keyboard or leaves a disclaimer gap; the latest reply is below
//   the chat viewport; focus/blur scrolls the document; keyboard viewport panning is ignored.
// - Structured question controls overflow the shortened viewport or cannot be tapped; its focused
//   custom-answer field is clipped inside the option list or covered by the fixed question footer.
// - A trip-fact editor (Where, Budget) or the stop editor keeps its focused field or its Save
//   button below the keyboard, leaves the tab bar over it, or scrolls the document (#187).
// - Planning changes tabs, no update dot appears, its name has no update announcement, or a
//   second plan with unchanged trip id/round is ignored; opening Trip fails to clear the dot.
// - Reload loses any of four saved tabs, legacy Chat/Map values fail, or switching panels resets
//   the Trip scroll position.
// - Back navigates away with a sheet, fact editor, settings dialog or stop editor open; closing
//   a sheet normally leaves a phantom history entry, or nested dialogs close their parent first.
// - Strings are missing in Chinese or phone hooks alter desktop viewport sizing.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/phone-state");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page) => page.waitForTimeout(400);
const tab = (page, name) =>
  page.locator(".phone-tabbar").getByRole("tab", { name: new RegExp(`^${name}`) });
const select = async (page, name) => {
  await tab(page, name).click();
  await settle(page);
};
async function viewport(page, height, offsetTop = 0) {
  await page.evaluate(
    ({ height, offsetTop }) => {
      window.__phoneViewport.height = height;
      window.__phoneViewport.offsetTop = offsetTop;
      window.__phoneViewport.dispatchEvent(new Event("resize"));
    },
    { height, offsetTop },
  );
  await settle(page);
}
// The keyboard is simulated by shrinking the fake visualViewport; everything the traveller needs
// while typing must sit inside [0, height] and be the topmost element at its centre.
async function editorAboveKeyboard(page, prefix, name, height) {
  await viewport(page, height);
  const g = await page.evaluate(() => {
    const field = document.activeElement;
    const editor = field?.closest(".fact-popover, .item-editor");
    const confirm = editor?.querySelector('.fact-form__primary, button[type="submit"]');
    const box = (node) => {
      const r = node.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), hit: node.contains(hit) };
    };
    const tabbar = document.querySelector(".phone-tabbar");
    return {
      typing: field?.matches("input, textarea") && !!editor,
      field: field ? box(field) : null,
      confirm: confirm ? box(confirm) : null,
      tabbar: tabbar?.checkVisibility() ? box(tabbar) : null,
      pageTop: scrollY,
    };
  });
  const inside = (b) => !!b && b.hit && b.top >= -1 && b.bottom <= height + 1;
  check(
    g.typing && inside(g.field),
    `${prefix}: ${name} field stays above keyboard (${JSON.stringify(g.field)})`,
  );
  check(
    inside(g.confirm),
    `${prefix}: ${name} Save stays above keyboard (${JSON.stringify(g.confirm)})`,
  );
  check(!g.tabbar, `${prefix}: tab bar does not cover ${name} while typing`);
  check(g.pageTop === 0, `${prefix}: typing in ${name} does not scroll document`);
  await page.screenshot({ path: `${OUT}/${prefix}-${name.replace(/\W+/g, "-")}-keyboard.png` });
  await page.evaluate(() => document.activeElement?.blur());
  await viewport(page, page.viewportSize().height);
}
async function run(browser, size) {
  const context = await browser.newContext({ viewport: size, hasTouch: true, isMobile: true });
  await context.addInitScript((size) => {
    const viewport = new EventTarget();
    Object.assign(viewport, {
      height: size.height,
      width: size.width,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
    });
    window.__phoneViewport = viewport;
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  }, size);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE);
  await page.locator(".phone-tabbar").waitFor();
  await page.addStyleTag({ content: "nextjs-portal {display:none!important}" });
  await select(page, "Mine");
  const live = page.getByRole("button", { name: /^Live data/ });
  if (await live.count()) await live.first().click();
  await select(page, "Chat");
  const responsePromise = page.waitForResponse((r) => r.url().endsWith("/api/chat"));
  await page.locator(".chat-empty__suggestions button").first().click();
  const response = (await (await responsePromise).text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .find((frame) => frame.type === "complete").response;
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180000 });
  await page.waitForFunction(
    () => document.querySelector(".workspace-shell")?.getAttribute("aria-busy") !== "true",
  );
  await settle(page);
  const prefix = `${size.width}x${size.height}`;
  check(
    (await tab(page, "Chat").getAttribute("aria-selected")) === "true",
    `${prefix}: planning stays on Chat`,
  );
  check(
    (await page.locator(".phone-tabbar__dot").count()) === 1,
    `${prefix}: planning sets Trip update dot`,
  );
  check(
    (await tab(page, "Trip").getAttribute("aria-label")) === "Trip updated",
    `${prefix}: Trip accessible name announces update`,
  );
  await select(page, "Mine");
  await page.getByRole("button", { name: "Switch language to 简体中文", exact: true }).click();
  await settle(page);
  check(
    (await tab(page, "行程").getAttribute("aria-label")) === "行程已更新",
    `${prefix}: Chinese Trip accessible name announces update`,
  );
  await page.getByRole("button", { name: "切换至 English", exact: true }).click();
  await settle(page);
  await select(page, "Chat");
  const input = page.locator(".composer__input");
  await input.focus();
  await settle(page);
  check(
    await page.locator(".phone-tabbar").isVisible(),
    `${prefix}: focus without keyboard keeps tabs`,
  );
  const shortened = size.height - 310;
  await viewport(page, shortened);
  check(!(await page.locator(".phone-tabbar").isVisible()), `${prefix}: keyboard hides tabs`);
  const geometry = await page.evaluate(() => ({
    bottom: document.querySelector(".chat__form").getBoundingClientRect().bottom,
    pageTop: scrollY,
    stream: document.querySelector(".chat__stream").getBoundingClientRect().bottom,
    latest: [...document.querySelectorAll(".msg-item")].at(-1).getBoundingClientRect().bottom,
  }));
  check(
    Math.abs(geometry.bottom - shortened) <= 2,
    `${prefix}: composer bottom equals viewport bottom (${geometry.bottom})`,
  );
  check(
    geometry.latest <= geometry.stream + 2,
    `${prefix}: latest reply is visible above composer`,
  );
  check(geometry.pageTop === 0, `${prefix}: keyboard focus does not scroll document`);
  await page.screenshot({ path: `${OUT}/${prefix}-keyboard.png` });
  await viewport(page, shortened - 20, 20);
  const pannedBottom = await page
    .locator(".chat__form")
    .evaluate((n) => n.getBoundingClientRect().bottom);
  check(Math.abs(pannedBottom - shortened) <= 2, `${prefix}: composer follows viewport offset`);
  await input.evaluate((n) => n.blur());
  await settle(page);
  check(
    await page.locator(".phone-tabbar").isVisible(),
    `${prefix}: blur restores tabs even before viewport recovers`,
  );
  await viewport(page, size.height);
  check(
    await page.evaluate(() => scrollY === 0),
    `${prefix}: keyboard blur does not scroll document`,
  );
  await viewport(page, shortened);
  check(
    await page.locator(".phone-tabbar").isVisible(),
    `${prefix}: shortened viewport without composer focus keeps tabs`,
  );
  await viewport(page, size.height);
  await select(page, "Trip");
  check(
    (await page.locator(".phone-tabbar__dot").count()) === 0,
    `${prefix}: opening Trip clears update dot`,
  );
  const scroll = await page.locator("#phone-panel-trip").evaluate((node) => {
    node.scrollTop = 140;
    return node.scrollTop;
  });
  await select(page, "Map");
  await select(page, "Trip");
  const restoredScroll = await page.locator("#phone-panel-trip").evaluate((n) => n.scrollTop);
  check(
    scroll > 0 && restoredScroll === scroll,
    `${prefix}: Trip scroll preserved (${restoredScroll})`,
  );
  // Same trip id and same planner round, but changed content: the read badge must reappear.
  await select(page, "Chat");
  const editedResponse = structuredClone(response);
  editedResponse.reply = "Phone state fixture: itinerary updated.";
  editedResponse.plan.sections[0].summary += " Updated route details.";
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "complete", response: editedResponse }) + "\n",
    }),
  );
  await input.fill("Update the route details");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(editedResponse.reply, { exact: true }).waitFor();
  await settle(page);
  check(
    (await page.locator(".phone-tabbar__dot").count()) === 1 &&
      (await tab(page, "Chat").getAttribute("aria-selected")) === "true",
    `${prefix}: same-round content update shows dot and stays on Chat`,
  );
  await select(page, "Trip");
  check(
    (await page.locator(".phone-tabbar__dot").count()) === 0,
    `${prefix}: opening revised Trip clears dot again`,
  );
  // The last stop sits lowest in the list; its editor must still clear the keyboard (#187).
  await page
    .getByRole("button", { name: /^Actions for/ })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Edit details", exact: true }).click();
  await page.locator(".item-editor input").first().waitFor();
  await settle(page);
  await page.locator(".item-editor input").first().focus();
  await editorAboveKeyboard(page, prefix, "stop editor", shortened);
  await page.locator(".item-editor").getByRole("button", { name: "Cancel", exact: true }).click();
  await settle(page);
  // Existing stop editor closes through its Escape path; Back must not leave the workspace.
  const actions = page.getByRole("button", { name: /^Actions for/ }).first();
  await actions.click();
  await page.getByRole("menuitem", { name: "Edit details", exact: true }).click();
  await page.locator(".item-editor").waitFor();
  await settle(page);
  await page.evaluate(() => history.back());
  await settle(page);
  check(
    (await page.locator(".item-editor").count()) === 0 && new URL(page.url()).pathname === "/",
    `${prefix}: Back closes stop editor`,
  );
  // Read two different trips and revisit each through Mine. Selection alone is not an update.
  const secondResponse = structuredClone(editedResponse);
  secondResponse.plan.tripId = `${editedResponse.plan.tripId}-second`;
  secondResponse.plan.brief.tripId = secondResponse.plan.tripId;
  secondResponse.plan.brief.destination = "Melbourne";
  secondResponse.reply = "Phone state fixture: second saved trip.";
  await page.unroute("**/api/chat");
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "complete", response: secondResponse }) + "\n",
    }),
  );
  await select(page, "Mine");
  await page
    .locator(".chats-panel__actions")
    .getByRole("button", { name: "New chat", exact: true })
    .click();
  await settle(page);
  await input.fill("Plan Melbourne for four days");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(secondResponse.reply, { exact: true }).waitFor();
  await settle(page);
  check(
    (await page.locator(".phone-tabbar__dot").count()) === 1,
    `${prefix}: new second trip is unread`,
  );
  await select(page, "Trip");
  for (const destination of ["Sydney", "Melbourne", "Sydney"]) {
    await select(page, "Mine");
    await page
      .locator(".trip-card")
      .filter({ hasText: `Trip to ${destination}` })
      .first()
      .click();
    await settle(page);
    check(
      (await page.locator(".phone-tabbar__dot").count()) === 0,
      `${prefix}: revisiting read ${destination} does not create an update`,
    );
  }
  // Structured questions keep choices and custom input reachable above the keyboard.
  await select(page, "Chat");
  await page.unroute("**/api/chat");
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "ask_user",
          questions: [
            {
              id: "pace",
              question: "How fast would you like to travel?",
              options: [{ label: "Relaxed" }, { label: "Busy" }],
            },
          ],
          known: response.plan.brief,
          plan: editedResponse.plan,
        }) + "\n",
    }),
  );
  await input.fill("Ask about the pace");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.locator(".question").waitFor();
  const custom = page.locator(".question__field-input").first();
  await custom.focus();
  await viewport(page, shortened);
  const questionBox = await page.locator(".question").boundingBox();
  check(
    questionBox.y >= 0 && questionBox.y + questionBox.height <= shortened + 2,
    `${prefix}: question card fits above keyboard`,
  );
  const relaxed = page.getByRole("radio", { name: /Relaxed/ });
  await relaxed.click();
  await settle(page);
  check(
    (await relaxed.getAttribute("aria-checked")) === "true",
    `${prefix}: question choice is tappable with shortened viewport`,
  );
  await custom.focus();
  await settle(page);
  const focusedGeometry = await custom.evaluate((node) => {
    const field = node.getBoundingClientRect();
    const body = node.closest(".question__body").getBoundingClientRect();
    const footer = node
      .closest(".question__card")
      .querySelector(".question__footer")
      .getBoundingClientRect();
    return {
      focused: document.activeElement === node,
      top: field.top,
      bottom: field.bottom,
      bodyTop: body.top,
      bodyBottom: body.bottom,
      footerTop: footer.top,
      pageTop: scrollY,
    };
  });
  check(
    focusedGeometry.focused &&
      focusedGeometry.top >= focusedGeometry.bodyTop - 1 &&
      focusedGeometry.bottom <= Math.min(focusedGeometry.bodyBottom, focusedGeometry.footerTop) + 1,
    `${prefix}: focused question answer remains fully visible above footer (${JSON.stringify(focusedGeometry)})`,
  );
  check(
    focusedGeometry.pageTop === 0,
    `${prefix}: revealing question answer does not scroll the page`,
  );
  await page.screenshot({ path: `${OUT}/${prefix}-question-keyboard.png` });
  await page
    .locator(".question__field-input")
    .first()
    .evaluate((n) => n.blur());
  await viewport(page, size.height);
  await page.unroute("**/api/chat");
  for (const name of ["Map", "Trip", "Mine", "Chat"]) {
    await select(page, name);
    await page.waitForTimeout(900);
    await page.reload();
    await page.locator(".phone-tabbar").waitFor();
    await page.addStyleTag({ content: "nextjs-portal {display:none!important}" });
    await settle(page);
    check(
      (await tab(page, name).getAttribute("aria-selected")) === "true",
      `${prefix}: reload restores ${name}`,
    );
  }
  // The initial saved trip is intentionally not auto-opened after reload. Its facts editor is
  // still available, and Back must close overlays without leaving this workspace.
  const title = page.locator(".phone-topbar__title-button");
  await title.click();
  await page.locator("#trip-facts-sheet").waitFor();
  await settle(page);
  await page.evaluate(() => history.back());
  await settle(page);
  check(
    (await page.locator("#trip-facts-sheet:not([data-leaving])").count()) === 0 &&
      new URL(page.url()).pathname === "/",
    `${prefix}: Back closes facts sheet in workspace`,
  );
  // Fact editors are bottom sheets; their focused field and Save must clear the keyboard (#187).
  for (const fact of ["where", "budget"]) {
    await title.click();
    await page.locator("#trip-facts-sheet").waitFor();
    await page.locator(`.facts-sheet__row[data-fact="${fact}"]`).click();
    await settle(page);
    await page.locator(".fact-popover:not([data-leaving]) input").first().focus();
    await editorAboveKeyboard(page, prefix, `${fact} editor`, shortened);
    await page.keyboard.press("Escape");
    await settle(page);
  }
  await title.click();
  await page.locator("#trip-facts-sheet").waitFor();
  await page.locator('.facts-sheet__row[data-fact="budget"]').click();
  await settle(page);
  const budget = page.getByRole("dialog", { name: "Budget", exact: true });
  check(await budget.isVisible(), `${prefix}: budget editor opens`);
  await page.evaluate(() => history.back());
  await settle(page);
  check(
    !(await budget.isVisible()) && new URL(page.url()).pathname === "/",
    `${prefix}: Back closes fact editor in workspace`,
  );
  await title.click();
  await page.locator("#trip-facts-sheet").waitFor();
  await settle(page);
  await page.keyboard.press("Escape");
  await settle(page);
  check(
    await page.evaluate(() => !history.state?.tripPhoneOverlay),
    `${prefix}: ordinary close removes overlay history guard`,
  );
  const ordinaryHistoryLength = await page.evaluate(() => history.length);
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await title.click();
    await page.locator("#trip-facts-sheet").waitFor();
    await settle(page);
    await page.keyboard.press("Escape");
    await settle(page);
  }
  check(
    await page.evaluate(
      (ordinaryHistoryLength) =>
        !history.state?.tripPhoneOverlay && history.length <= ordinaryHistoryLength + 1,
      ordinaryHistoryLength,
    ),
    `${prefix}: repeated ordinary closes do not accumulate phantom entries`,
  );
  await page.evaluate(() => history.forward());
  await settle(page);
  check(
    (await page.evaluate(() => !history.state?.tripPhoneOverlay)) &&
      (await page.getByRole("dialog").count()) === 0,
    `${prefix}: Forward skips orphan overlay entry`,
  );
  await select(page, "Mine");
  await page.getByRole("button", { name: "Settings & account", exact: true }).click();
  await page.locator("dialog[open]").waitFor();
  await settle(page);
  await page.evaluate(() => history.back());
  await settle(page);
  check(
    (await page.locator("dialog[open]").count()) === 0 && new URL(page.url()).pathname === "/",
    `${prefix}: Back closes native settings dialog`,
  );
  await page.screenshot({ path: `${OUT}/${prefix}-back.png` });
  check(errors.length === 0, `${prefix}: no browser errors (${errors.join(" | ")})`);
  await context.close();
}
const browser = await chromium.launch(
  process.env.CHANNEL ? { channel: process.env.CHANNEL } : undefined,
);
try {
  for (const size of [
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ])
    await run(browser, size);
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify({ base: BASE, results }, null, 2));
}
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
