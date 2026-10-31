import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { plan, settings, stop } from "./chat-generation-fixture.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.env.E2E_OUTPUT_DIR ?? "output/playwright/chat-header/red");
mkdirSync(OUT, { recursive: true });
const results = [];
const errors = [];
let current;
const check = (ok, name) => {
  results.push({ ok: Boolean(ok), name });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
};
const stamp = "2026-10-20T00:00:00.000Z";
const trips = ["sydney", "melbourne"].map((id) => {
  const destination = id === "sydney" ? "Sydney" : "Melbourne";
  return {
    id: `trip:${id}`,
    title: `${destination} holiday`,
    renamed: true,
    updatedAt: stamp,
    conversationIds:
      id === "sydney"
        ? ["conversation:one", "conversation:two", "conversation:three", "conversation:four"]
        : ["conversation:five"],
    snapshot: {
      version: 4,
      id,
      savedAt: stamp,
      plan: plan({ id, destination, items: [stop(`${destination} landmark`, 1, "09:00")] }),
      draft: {
        destination,
        origin: "",
        start: "2031-03-10",
        end: "2031-03-12",
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
    },
  };
});
const catalog = {
  version: 5,
  trips,
  conversations: [
    ["one", "Harbour walk", 0],
    ["two", "Food ideas", 0],
    ["three", "Ferry plan", 0],
    ["four", "Tide notes", 0],
    ["five", "Museum notes", 1],
  ].map(([id, title, trip]) => ({
    id: `conversation:${id}`,
    title,
    renamed: true,
    updatedAt: stamp,
    tripId: trips[trip].id,
    snapshot: { ...trips[trip].snapshot, id },
    messages: [{ role: "user", text: `${title} marker`, at: Date.parse(stamp) }],
    input: "",
  })),
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "chat",
    editorView: "timeline",
  },
};
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    ({ catalog, settings }) => {
      if (sessionStorage.getItem("header-seeded")) return;
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
      localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
      localStorage.setItem("trip.dataMode", "mock");
      sessionStorage.setItem("header-seeded", "yes");
    },
    { catalog, settings },
  );
  const page = await context.newPage();
  current = page;
  page.setDefaultTimeout(8000);
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === new URL(BASE).origin ? route.continue() : route.abort();
  });
  await page.goto(BASE);
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Chats/ })
    .click();
  await page
    .locator(".chats-panel")
    .getByRole("button", { name: /Harbour walk/ })
    .first()
    .click();
  const title = page.locator(".chat-header__title");
  check(await title.isVisible(), "Current Chat has a title menu");
  if (!(await title.isVisible())) throw new Error("Chat title menu is missing");
  await title.click();
  await page.getByRole("menuitem", { name: /Switch chat/ }).click();
  await page.getByRole("menuitem", { name: "Food ideas", exact: true }).click();
  await page.locator(".chat-header__title").filter({ hasText: "Food ideas" }).waitFor();
  const originalPlans = await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3"));
    return value.trips.map(({ id, snapshot }) => ({ id, plan: snapshot.plan }));
  });
  check(true, "Switch chat opens sibling in the ordinary Chat workspace");
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: "Trajectory", exact: true })
    .click();
  await page.getByRole("region", { name: "Trajectory", exact: true }).waitFor();
  await title.click();
  await page.getByRole("menuitem", { name: "Return to chat", exact: true }).click();
  await page.getByRole("region", { name: "Conversation", exact: true }).waitFor();
  check(true, "Sidebar Trajectory has a working return to Conversation");
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: "Trajectory", exact: true })
    .click();
  await title.click();
  await page.getByRole("menuitem", { name: "View trip", exact: true }).click();
  await page.locator(".trip-home").waitFor();
  await page
    .locator(".trip-home")
    .getByRole("button", { name: /Food ideas/ })
    .first()
    .click();
  await title.filter({ hasText: "Food ideas" }).waitFor();
  await page.getByRole("region", { name: "Conversation", exact: true }).waitFor();
  check(
    (await page.locator(".trip-home").count()) === 0,
    "View trip and its Chat link navigate between distinct pages",
  );
  await title.click();
  await page.getByRole("menuitem", { name: /Move to another trip/ }).click();
  await page.getByRole("menuitem", { name: "Melbourne holiday", exact: true }).click();
  await page.locator(".chat-header__trip-name").filter({ hasText: "Melbourne holiday" }).waitFor();
  check(
    await page.getByText("Food ideas marker", { exact: true }).isVisible(),
    "Move preserves the current Chat messages",
  );
  const waitStored = (predicate) =>
    page.waitForFunction(
      ({ predicate }) => {
        const value = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3"));
        return Function("value", `return (${predicate})(value)`)(value);
      },
      { predicate: predicate.toString() },
    );
  await waitStored(
    (value) =>
      value.conversations.find((chat) => chat.id === "conversation:two")?.tripId ===
      "trip:melbourne",
  );
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: "Trajectory", exact: true })
    .click();
  await title.click();
  await page.getByRole("menuitem", { name: /Switch chat/ }).click();
  await page.getByRole("menuitem", { name: "New chat", exact: true }).click();
  await page.getByRole("region", { name: "Conversation", exact: true }).waitFor();
  await waitStored(
    (value) =>
      value.activeConversationId !== "conversation:two" &&
      value.conversations.find((chat) => chat.id === value.activeConversationId)?.tripId ===
        "trip:melbourne",
  );
  check(
    (await page.locator(".chat-header__trip-name").textContent()) === "Melbourne holiday",
    "Switcher New chat is immediately associated with the current Trip",
  );
  await title.click();
  await page.getByRole("menuitem", { name: /Switch chat/ }).click();
  await page.getByRole("menuitem", { name: "Food ideas", exact: true }).click();
  await title.click();
  await page.getByRole("menuitem", { name: /Move to another trip/ }).click();
  await page.getByRole("menuitem", { name: "New trip", exact: true }).click();
  await waitStored(
    (value) =>
      value.trips.length === 3 &&
      value.conversations.find((chat) => chat.id === "conversation:two")?.tripId !==
        "trip:melbourne",
  );
  check(
    await page.getByText("Food ideas marker", { exact: true }).isVisible(),
    "New trip retains the Chat and copies its current plan",
  );
  const afterMove = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("trip-workspace-catalog-v3")),
  );
  check(
    originalPlans.every(
      (trip) =>
        JSON.stringify(afterMove.trips.find((item) => item.id === trip.id)?.snapshot.plan) ===
        JSON.stringify(trip.plan),
    ),
    "Moving and creating a Trip preserve both original itineraries",
  );
  const openChat = async (name) => {
    if (!(await page.locator(".chats-panel.is-open").count()))
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Chats/ })
        .click();
    await page
      .locator(".chats-panel")
      .getByRole("button", { name: new RegExp(name) })
      .first()
      .click();
  };
  check(
    (await title.count()) === 0 && (await page.locator(".chat-header__trip-name").count()) === 1,
    "The only Chat in a Trip keeps its Trip name without the switch menu",
  );
  await openChat("Harbour walk");
  await title.filter({ hasText: "Harbour walk" }).waitFor();
  await title.click();
  await page.getByRole("menuitem", { name: "Remove from trip", exact: true }).click();
  await waitStored(
    (value) =>
      !value.conversations.find((chat) => chat.id === "conversation:one")?.tripId &&
      value.trips.length === 3,
  );
  await page.reload();
  await openChat("Harbour walk");
  await page.locator(".chat-header__plain").filter({ hasText: "Harbour walk" }).waitFor();
  check(
    (await page.locator(".chat-header__trip-name").count()) === 0 &&
      (await page.getByText("Harbour walk marker", { exact: true }).isVisible()),
    "Detached Chat stays detached with messages after reload",
  );
  check(
    (await title.count()) === 0 && (await page.locator(".chat-header__plain").count()) === 1,
    "A Chat outside a Trip has a plain title and no Trip menu",
  );
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: "Trajectory", exact: true })
    .click();
  await page.getByRole("region", { name: "Trajectory", exact: true }).waitFor();
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: "Trajectory", exact: true })
    .click();
  await page.getByRole("region", { name: "Conversation", exact: true }).waitFor();
  check(true, "Sidebar Trajectory toggles back to Conversation without a title menu");
  await openChat("Ferry plan");
  await title.filter({ hasText: "Ferry plan" }).waitFor();
  await title.click();
  await page.getByRole("menuitem", { name: /Switch chat/ }).click();
  await page.keyboard.press("Escape");
  check(
    (await page.getByRole("menu").count()) === 0 &&
      (await title.evaluate((el) => el === document.activeElement)),
    "Escape dismisses a submenu and restores title focus",
  );
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: `${JSON.stringify({ type: "error", error: "Controlled header failure" })}\n`,
    }),
  );
  await page.locator(".composer textarea").fill("Controlled failed turn");
  await page.locator(".composer textarea").press("Enter");
  await page.getByRole("button", { name: "Retry update", exact: true }).waitFor();
  await title.click();
  await page.getByRole("menuitem", { name: "Remove from trip", exact: true }).click();
  await waitStored(
    (value) => !value.conversations.find((chat) => chat.id === "conversation:three")?.tripId,
  );
  check(
    (await page.getByRole("button", { name: "Retry update", exact: true }).count()) === 0 &&
      (await page.locator(".chat-header__trip-name").count()) === 0,
    "Detaching a failed turn clears its old Retry and Trip context",
  );
  await page.reload();
  await openChat("Ferry plan");
  await page.locator(".chat-header__plain").filter({ hasText: "Ferry plan" }).waitFor();
  check(
    (await page.locator(".chat-header__trip-name").count()) === 0 &&
      (await page
        .getByRole("region", { name: "Conversation", exact: true })
        .getByText("Controlled failed turn", { exact: true })
        .isVisible()),
    "Failed Chat stays detached with messages after reload",
  );
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Chats/ })
    .click();
  const rowMenu = (name) =>
    page.locator(".chats-panel").getByRole("button", { name: `Actions for ${name}` });
  await rowMenu("Harbour walk").click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const renameDialog = page.getByRole("dialog", { name: "Rename chat" });
  const nameField = renameDialog.getByRole("textbox", { name: "Rename chat" });
  await page.waitForFunction(() => document.activeElement?.tagName === "INPUT");
  check(
    (await nameField.inputValue()) === "Harbour walk" &&
      (await nameField.evaluate((el) => el.selectionEnd - el.selectionStart)) === 12,
    "Rename opens on the current title, focused and selected",
  );
  await nameField.fill("   ");
  check(
    await renameDialog.getByRole("button", { name: "Save", exact: true }).isDisabled(),
    "A blank name cannot be saved",
  );
  await page.keyboard.press("Escape");
  await renameDialog.waitFor({ state: "detached" });
  check(
    (await rowMenu("Harbour walk").evaluate((el) => el === document.activeElement)) &&
      (await page.locator(".chats-panel.is-open").count()) === 1,
    "Escape keeps the name, the Chats panel and focus on the row menu",
  );
  await rowMenu("Harbour walk").click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await nameField.fill("Walk research");
  await nameField.press("Enter");
  await waitStored(
    (value) =>
      value.conversations.find((chat) => chat.id === "conversation:one")?.title === "Walk research",
  );
  check(true, "Rename changes the selected Chat and persists");
  await rowMenu("Walk research").click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Delete chat" });
  check(
    (await deleteDialog.innerText()).includes("Walk research"),
    "Delete names the Chat it will remove",
  );
  await deleteDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await deleteDialog.waitFor({ state: "detached" });
  check(
    (await page.locator(".chats-panel").getByText("Walk research").count()) >= 1,
    "Cancelling delete keeps the Chat",
  );
  await rowMenu("Walk research").click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();
  await waitStored(
    (value) =>
      !value.conversations.some((chat) => chat.id === "conversation:one") &&
      value.trips.length === 3,
  );
  check(true, "Delete removes only the selected Chat and retains every Trip");
  await page.screenshot({ path: resolve(OUT, "desktop.png") });
  await context.close();
  for (const [language, width] of [
    ["en", 1440],
    ["zh", 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: width <= 520 ? 844 : 1000 },
      reducedMotion: "reduce",
      colorScheme: language === "zh" ? "dark" : "light",
    });
    await context.addInitScript(
      ({ catalog, settings, language }) => {
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem("trip.settings.v1", JSON.stringify({ ...settings, language }));
      },
      { catalog, settings, language },
    );
    const page = await context.newPage();
    current = page;
    page.setDefaultTimeout(8000);
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === new URL(BASE).origin
        ? route.continue()
        : route.abort(),
    );
    await page.goto(BASE);
    if (width <= 520) {
      await page
        .getByRole("tab", { name: language === "en" ? "Mine" : "我的", exact: true })
        .click();
      await page
        .locator(".phone-mine")
        .getByRole("button", { name: /Harbour walk/ })
        .first()
        .click();
    } else {
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Chats|^聊天/ })
        .click();
      await page
        .locator(".chats-panel")
        .getByRole("button", { name: /Harbour walk/ })
        .first()
        .click();
    }
    const trigger = page.locator(".chat-header__title");
    await trigger.waitFor();
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const switcher = page.getByRole("menuitem", {
      name: language === "en" ? "Switch chat" : "换个聊天",
      exact: false,
    });
    if (width <= 520) await switcher.click();
    else await switcher.hover();
    await page.getByRole("menuitem", { name: "Food ideas", exact: true }).waitFor();
    check(true, `${language} ${width}: keyboard opens header; hover opens sibling switcher`);
    await page.screenshot({ path: resolve(OUT, `${language}-${width}-menu.png`) });
    await page.keyboard.press("Escape");
    const size = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    check(size.scroll === size.width, `${language} ${width}: no horizontal page overflow`);
    if (width <= 520) {
      const composer = page.locator(".composer textarea");
      check(await composer.isVisible(), `${language} ${width}: composer remains visible`);
      await page.getByRole("button", { name: /Trip details:|行程信息：/ }).click();
      await page.getByRole("dialog").waitFor();
      check(true, `${language} ${width}: Trip facts remain reachable beside Chat header`);
    } else {
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: language === "en" ? "Trajectory" : "轨迹", exact: true })
        .click();
      await page
        .getByRole("region", { name: language === "en" ? "Trajectory" : "轨迹", exact: true })
        .waitFor();
      await page.locator(".workspace-drawer--nav").waitFor({ state: "hidden" });
      check(true, `${language} ${width}: Trajectory closes navigation drawer`);
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: "New chat", exact: true })
        .click();
      await page
        .getByRole("region", { name: language === "en" ? "Conversation" : "对话", exact: true })
        .waitFor();
      check(true, `${language} ${width}: New chat resets Trajectory, including phone resize`);
    }
    await context.close();
  }
} catch (error) {
  check(false, String(error));
  await current?.screenshot({ path: resolve(OUT, "failure.png") }).catch(() => {});
} finally {
  await browser.close();
  writeFileSync(resolve(OUT, "results.json"), JSON.stringify({ results, errors }, null, 2));
}
process.exitCode = results.every((item) => item.ok) && errors.length === 0 ? 0 : 1;
