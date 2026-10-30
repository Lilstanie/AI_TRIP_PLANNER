import { mkdirSync, writeFileSync } from "node:fs";
import {
  controlledProxy,
  catalog,
  settings,
  plan,
  stop,
  completedPlan,
  completedGammaPlan,
} from "./chat-generation-fixture.mjs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = new URL(process.env.BASE_URL ?? "http://localhost:3000");
const OUT = resolve(
  process.env.E2E_OUTPUT_DIR ??
    `output/playwright/chat-generation/${process.env.LABEL ?? Date.now()}`,
);
const WAIT = 5_000;
mkdirSync(OUT, { recursive: true });

const within = (promise, label, timeout = WAIT) =>
  new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeout}ms`)), timeout);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolvePromise(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const results = [];
const checkpoints = [];
const browserErrors = [];
const externalRequests = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const checkpoint = (name, proxy) => {
  const value = {
    name,
    requestCount: proxy.requests.length,
    aborted: proxy.requests.filter((entry) => entry.aborted).length,
    completed: proxy.requests.filter((entry) => entry.completed).length,
    failed: proxy.requests.filter((entry) => entry.failed).length,
  };
  checkpoints.push(value);
  check(proxy.requests.length === 1 && !proxy.requests[0]?.aborted, name, value);
};

const proxy = controlledProxy(BASE, within);
const proxyUrl = await proxy.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const openPage = async (viewport = { width: 1440, height: 1000 }) => {
  const context = await browser.newContext({
    viewport,
    ...(viewport.width <= 520 ? { isMobile: true, hasTouch: true } : {}),
    reducedMotion: "reduce",
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
  });
  await context.addInitScript(
    ({ catalog, settings }) => {
      if (localStorage.getItem("chat-generation-seeded")) return;
      localStorage.setItem("chat-generation-seeded", "1");
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
      localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
    },
    { catalog, settings },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(WAIT);
  page.setDefaultNavigationTimeout(WAIT);
  page.on("pageerror", (error) => browserErrors.push(String(error)));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === new URL(proxyUrl).port) {
      return route.continue();
    }
    externalRequests.push(url.href);
    return route.abort();
  });
  await page.goto(proxyUrl, { waitUntil: "domcontentloaded", timeout: WAIT });
  await page.locator(".workspace-app").waitFor({ timeout: WAIT });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  if (viewport.width <= 520) {
    await page.locator(".workspace-app[data-phone]").waitFor({ timeout: WAIT });
  }
  await switchChat(page, "Alpha");
  await page.getByText("Alpha marker", { exact: true }).waitFor({ timeout: WAIT });
  return { context, page };
};

const composer = (page) => page.getByRole("textbox", { name: "Message AI Trip Planner" });
const isPhone = async (page) => (await page.locator(".workspace-app[data-phone]").count()) > 0;
const selectPhoneTab = async (page, name) => {
  await page
    .getByRole("tablist", { name: "Workspace sections" })
    .getByRole("tab", { name, exact: true })
    .click();
};
const openTripPanel = async (page) => {
  if (await isPhone(page)) {
    await selectPhoneTab(page, "Trip");
  } else if (!(await page.getByRole("region", { name: "Trip timeline" }).isVisible())) {
    await page.getByRole("button", { name: "Open your trip" }).click();
  }
  await page.getByRole("region", { name: "Trip timeline" }).waitFor();
};
const waitForControlledProgress = async (page) => {
  const thinking = page.getByRole("region", { name: "Thinking process" });
  await thinking.waitFor();
  for (const selector of [".thinking-turn", ".thinking-subagent__row", ".thinking-reasoning"]) {
    const toggle = thinking.locator(`${selector} > .thinking-row__line > button`).last();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  }
  await thinking.getByText("Controlled partial reasoning", { exact: true }).waitFor();
};
const removeBaseStop = async (page) => {
  await switchChat(page, "Beta");
  await page.getByText("Beta marker", { exact: true }).waitFor();
  await openTripPanel(page);
  const timeline = page.getByRole("region", { name: "Trip timeline" });
  const row = timeline
    .locator(".timeline-stop")
    .filter({
      has: page.locator(".timeline-stop__name", { hasText: "alpha-base" }),
    })
    .first();
  await row.locator(".action-menu__trigger").click();
  await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
  await page
    .locator(".timeline-stop__name")
    .filter({ hasText: "alpha-base" })
    .waitFor({ state: "detached" });
  await closeTripPanel(page);
  await composer(page).waitFor();
};
const closeTripPanel = async (page) => {
  if (await isPhone(page)) {
    if (
      (await page
        .getByRole("tablist", { name: "Workspace sections" })
        .getByRole("tab", { name: "Chat", exact: true })
        .getAttribute("aria-selected")) !== "true"
    ) {
      await selectPhoneTab(page, "Chat");
    }
    return;
  }
  const tripToggle = page.getByRole("button", { name: "Open your trip" });
  if ((await tripToggle.count()) === 0) return;
  if ((await tripToggle.getAttribute("aria-expanded")) === "true") {
    await tripToggle.click();
    await page.getByRole("region", { name: "Trip timeline" }).waitFor({ state: "hidden" });
  }
};
const assertLatestPlan = async (page, name) => {
  await openTripPanel(page);
  check(
    (await page.locator(".timeline-stop__name").filter({ hasText: "alpha-base" }).count()) === 0,
    name,
  );
  await waitStored(page, (value) => {
    const trip = value?.trips?.find((item) => item.id === "trip:alpha");
    return (
      trip?.snapshot.plan.editVersion > 0 &&
      !trip.snapshot.plan.sections
        .flatMap((section) => section.proposal?.items ?? [])
        .some((item) => item.id === "alpha-base")
    );
  });
  await closeTripPanel(page);
  await composer(page).waitFor();
};
const switchChat = async (page, name) => {
  if (await isPhone(page)) {
    await composer(page)
      .blur()
      .catch(() => undefined);
    await selectPhoneTab(page, "Mine");
    await page.locator(".phone-mine").waitFor();
    await page
      .locator(".phone-mine .history-item:not(.history-item--trip)")
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .first()
      .click({ timeout: WAIT });
    await page
      .getByRole("tablist", { name: "Workspace sections" })
      .getByRole("tab", { name: "Chat", exact: true })
      .waitFor();
    return;
  }
  const chats = page.locator(".sidebar-nav").getByRole("button", { name: /^Chats/ });
  if ((await chats.getAttribute("aria-expanded")) !== "true") await chats.click();
  await page
    .locator(".history-item:not(.history-item--trip)")
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .first()
    .click({ timeout: WAIT });
  await closeTripPanel(page);
};
const send = async (page, text) => {
  const input = composer(page);
  await input.fill(text);
  await input.press("Enter");
};
const waitStored = (page, predicate, arg) =>
  page.waitForFunction(
    ({ predicate, arg }) => {
      const value = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
      return Function("value", "arg", `return (${predicate})(value, arg);`)(value, arg);
    },
    { predicate: predicate.toString(), arg },
    { timeout: WAIT },
  );

try {
  const { context, page } = await openPage();
  await send(page, "Alpha background request");
  await proxy.waitForCount(1);
  const background = proxy.requests[0];
  await waitForControlledProgress(page);
  check(
    background.body.message === "Alpha background request",
    "the initiating Chat sends the controlled request",
    background.body,
  );
  checkpoint("request starts in Alpha", proxy);

  await switchChat(page, "Beta");
  await page.getByText("Beta marker", { exact: true }).waitFor({ timeout: WAIT });
  checkpoint("another Chat is open", proxy);

  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Trips/ })
    .click();
  await page.locator(".trip-cards").waitFor({ timeout: WAIT });
  checkpoint("Trips page is open", proxy);

  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Calendar/ })
    .click();
  await page.locator(".trips-page__tabs").waitFor({ timeout: WAIT });
  checkpoint("Calendar page is open", proxy);

  await page.locator(".account-button__more").click();
  await page.getByRole("menuitem", { name: "Personalization", exact: true }).click();
  await page.locator(".settings-nav").waitFor({ timeout: WAIT });
  checkpoint("Settings are open", proxy);
  await page.keyboard.press("Escape");

  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Trips/ })
    .click();
  await page
    .locator(".trip-cards")
    .getByRole("button", { name: /Gamma trip/ })
    .first()
    .click();
  await page.locator(".trip-home").waitFor({ timeout: WAIT });
  checkpoint("another Trip is open", proxy);

  await switchChat(page, "Alpha");
  await waitForControlledProgress(page);
  check(
    (await page.getByText("Alpha background request", { exact: true }).count()) === 1,
    "returning while pending restores one user message and live progress",
  );
  checkpoint("return to the initiating Chat while pending", proxy);

  await switchChat(page, "Beta");
  background.release(completedPlan, "Alpha completed reply");
  await within(background.settled, "background completion");
  await waitStored(
    page,
    (value, reply) =>
      value?.conversations
        ?.find((item) => item.id === "conversation:alpha")
        ?.messages.some((message) => message.role === "agent" && message.text === reply),
    "Alpha completed reply",
  );
  check(
    (await page.getByText("Alpha completed reply", { exact: true }).count()) === 0,
    "a background result does not appear in the visible Chat",
  );
  await composer(page).fill("Beta unsent after completion");
  await waitStored(
    page,
    (value) =>
      value?.conversations?.find((item) => item.id === "conversation:beta")?.input ===
      "Beta unsent after completion",
  );
  const visibleSaved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("trip-workspace-catalog-v3")),
  );
  check(
    visibleSaved.trips.find((item) => item.id === "trip:alpha").snapshot.plan.sections[0].proposal
      .items[0]?.id === "generated-alpha",
    "typing in the visible Chat preserves the background Trip result",
  );
  await switchChat(page, "Alpha");
  await page.getByText("Alpha completed reply", { exact: true }).waitFor({ timeout: WAIT });
  check(proxy.requests.length === 1, "completion and recovery do not repeat the request");
  check(
    (await page.getByText("Alpha background request", { exact: true }).count()) === 1,
    "completion and recovery do not repeat the user message",
  );
  await page.screenshot({ path: `${OUT}/background-completion.png` });
  await context.close();

  proxy.reset();
  const stopJourney = await openPage();
  await send(stopJourney.page, "Alpha stop request");
  await proxy.waitForCount(1);
  const stopped = proxy.requests[0];
  await stopJourney.page.getByRole("button", { name: "Stop planning" }).click();
  await within(stopped.settled, "Stop request settles");
  check(stopped.aborted, "Stop aborts the controlled request", stopped);
  await stopJourney.page.getByText("Planning stopped.", { exact: true }).waitFor({ timeout: WAIT });
  check(
    (await stopJourney.page.getByRole("button", { name: "Retry update" }).count()) === 0,
    "Stop shows no Retry action",
  );
  check(proxy.requests.length === 1, "Stop does not repeat the request");
  await removeBaseStop(stopJourney.page);
  await switchChat(stopJourney.page, "Alpha");
  await stopJourney.page.getByText("Planning stopped.", { exact: true }).waitFor();
  await assertLatestPlan(stopJourney.page, "stopped Chat restores latest P2 before new send");
  stopJourney.page.once("dialog", (dialog) => dialog.accept());
  await send(stopJourney.page, "Alpha after stop");
  await proxy.waitForCount(2);
  const afterStop = proxy.requests[1];
  check(
    afterStop.body.message === "Alpha after stop",
    "a new send can start after the stopped turn",
    afterStop.body,
  );
  check(
    (await stopJourney.page.getByText("Alpha stop request", { exact: true }).count()) === 1 &&
      (await stopJourney.page.getByText("Alpha after stop", { exact: true }).count()) === 1,
    "post-Stop send keeps both user messages exactly once",
  );
  stopped.release(completedPlan, "Stopped late reply");
  await assertLatestPlan(
    stopJourney.page,
    "late stopped response cannot mutate replacement turn Plan",
  );
  check(
    (await stopJourney.page.getByText("Stopped late reply", { exact: true }).count()) === 0,
    "late stopped reply is absent while replacement request runs",
  );
  afterStop.release(completedPlan, "After stop completed reply");
  await within(afterStop.settled, "post-Stop completion");
  await stopJourney.page
    .getByText("After stop completed reply", { exact: true })
    .waitFor({ timeout: WAIT });
  check(proxy.requests.length === 2, "post-Stop recovery starts exactly one new request");
  await stopJourney.page.screenshot({ path: `${OUT}/stop.png` });
  await stopJourney.context.close();

  proxy.reset();
  const failureJourney = await openPage();
  await send(failureJourney.page, "Alpha retry request");
  await proxy.waitForCount(1);
  const failed = proxy.requests[0];
  await removeBaseStop(failureJourney.page);
  failed.fail("Controlled planning failure.");
  await within(failed.settled, "failure settles");
  await switchChat(failureJourney.page, "Alpha");
  await assertLatestPlan(failureJourney.page, "failed Chat restores latest P2 before Retry");
  await failureJourney.page
    .getByRole("alert")
    .filter({ hasText: "Controlled planning failure." })
    .waitFor({ timeout: WAIT });
  await waitStored(
    failureJourney.page,
    (value, text) =>
      value?.conversations
        ?.find((item) => item.id === "conversation:alpha")
        ?.messages.filter((message) => message.role === "user" && message.text === text).length ===
      1,
    "Alpha retry request",
  );
  check(
    (await failureJourney.page
      .locator(".msg-item--user")
      .getByText("Alpha retry request", { exact: true })
      .count()) === 1,
    "failure retains the accepted user message",
  );
  failureJourney.page.once("dialog", (dialog) => dialog.accept());
  await failureJourney.page.getByRole("button", { name: "Retry update" }).click();
  await proxy.waitForCount(2);
  const retried = proxy.requests[1];
  check(
    (await failureJourney.page
      .locator(".msg-item--user")
      .getByText("Alpha retry request", { exact: true })
      .count()) === 1,
    "Retry reuses the existing user message without duplicating it",
  );
  check(proxy.requests.length === 2, "Retry starts one new controlled request");
  retried.release(completedPlan, "Retry completed reply");
  await within(retried.settled, "retry completion");
  await failureJourney.page
    .getByText("Retry completed reply", { exact: true })
    .waitFor({ timeout: WAIT });
  await assertLatestPlan(failureJourney.page, "Retry of P1 cannot overwrite latest P2");
  await failureJourney.page.screenshot({ path: `${OUT}/failure-retry.png` });
  await failureJourney.context.close();

  proxy.reset();
  const concurrentJourney = await openPage();
  await send(concurrentJourney.page, "Alpha concurrent request");
  await proxy.waitForCount(1);
  const alphaConcurrent = proxy.requests[0];
  await switchChat(concurrentJourney.page, "Gamma");
  await concurrentJourney.page
    .getByText("Gamma marker", { exact: true })
    .waitFor({ timeout: WAIT });
  await send(concurrentJourney.page, "Gamma concurrent request");
  await proxy.waitForCount(2);
  const gammaConcurrent = proxy.requests[1];
  check(
    alphaConcurrent.body.tripId === "alpha" && gammaConcurrent.body.tripId === "gamma",
    "different Trips start independent controlled requests",
    { alpha: alphaConcurrent.body.tripId, gamma: gammaConcurrent.body.tripId },
  );
  gammaConcurrent.release(completedGammaPlan, "Gamma completed reply");
  await within(gammaConcurrent.settled, "Gamma concurrent completion");
  await concurrentJourney.page
    .getByText("Gamma completed reply", { exact: true })
    .waitFor({ timeout: WAIT });
  check(
    (await concurrentJourney.page.getByText("Alpha completed reply", { exact: true }).count()) ===
      0,
    "one Trip's completion stays out of the other Trip's visible Chat",
  );
  alphaConcurrent.release(completedPlan, "Alpha completed reply");
  await within(alphaConcurrent.settled, "Alpha concurrent completion");
  await waitStored(concurrentJourney.page, (value) => {
    const messages = (id) => value?.conversations?.find((item) => item.id === id)?.messages ?? [];
    return (
      messages("conversation:alpha").filter((message) => message.text === "Alpha completed reply")
        .length === 1 &&
      messages("conversation:gamma").filter((message) => message.text === "Gamma completed reply")
        .length === 1 &&
      value?.trips?.find((item) => item.id === "trip:alpha")?.snapshot.plan.brief.destination ===
        "Alpha" &&
      value?.trips?.find((item) => item.id === "trip:gamma")?.snapshot.plan.brief.destination ===
        "Gamma"
    );
  });
  await switchChat(concurrentJourney.page, "Alpha");
  await concurrentJourney.page
    .getByText("Alpha completed reply", { exact: true })
    .waitFor({ timeout: WAIT });
  await concurrentJourney.page.screenshot({ path: `${OUT}/concurrent-trips.png` });
  await concurrentJourney.context.close();

  proxy.reset();
  const conflictJourney = await openPage();
  await send(conflictJourney.page, "Alpha conflict request");
  await proxy.waitForCount(1);
  const conflict = proxy.requests[0];
  await removeBaseStop(conflictJourney.page);
  await switchChat(conflictJourney.page, "Alpha");
  await waitForControlledProgress(conflictJourney.page);
  await assertLatestPlan(
    conflictJourney.page,
    "running Chat restores latest P2 before delayed completion",
  );
  await switchChat(conflictJourney.page, "Beta");
  await switchChat(conflictJourney.page, "Alpha");
  await waitForControlledProgress(conflictJourney.page);
  await openTripPanel(conflictJourney.page);
  check(
    (await conflictJourney.page
      .locator(".timeline-stop__name")
      .filter({ hasText: "alpha-base" })
      .count()) === 0,
    "returning to a pending Chat keeps another Chat's newer Plan edit",
  );
  await closeTripPanel(conflictJourney.page);
  conflict.release(
    plan({
      id: "alpha",
      destination: "Alpha",
      items: [stop("alpha-base", 1, "09:00")],
    }),
    "Generated reply despite edit",
  );
  await within(conflict.settled, "conflict completion");
  await waitStored(
    conflictJourney.page,
    (value) =>
      value?.conversations
        ?.find((item) => item.id === "conversation:alpha")
        ?.messages.some(
          (message) =>
            message.text === "Generated reply despite edit" &&
            message.conflictNotice?.key ===
              "The plan changed while this reply was being prepared. Your edits were kept.",
        ) === true,
  );
  await switchChat(conflictJourney.page, "Alpha");
  await conflictJourney.page
    .getByText("Generated reply despite edit", { exact: true })
    .waitFor({ timeout: WAIT });
  await conflictJourney.page
    .getByText("The plan changed while this reply was being prepared. Your edits were kept.", {
      exact: true,
    })
    .waitFor({ timeout: WAIT });
  check(
    (await conflictJourney.page
      .locator(".timeline-stop__name")
      .filter({ hasText: "alpha-base" })
      .count()) === 0,
    "a late generated Plan does not restore the manually removed stop",
  );
  await waitStored(
    conflictJourney.page,
    (value, stopId) => {
      const items =
        value?.trips
          ?.find((item) => item.id === "trip:alpha")
          ?.snapshot.plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ??
        [];
      return !items.some((item) => item.id === stopId);
    },
    "alpha-base",
  );
  await assertLatestPlan(conflictJourney.page, "conflict completion keeps visible P2");
  await conflictJourney.page.reload({ waitUntil: "domcontentloaded" });
  await conflictJourney.page.locator(".workspace-app").waitFor({ timeout: WAIT });
  await conflictJourney.page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await switchChat(conflictJourney.page, "Alpha");
  await conflictJourney.page
    .locator(".msg-item--agent")
    .getByText("Generated reply despite edit", { exact: true })
    .waitFor();
  await conflictJourney.page
    .getByText("The plan changed while this reply was being prepared. Your edits were kept.", {
      exact: true,
    })
    .waitFor();
  await assertLatestPlan(
    conflictJourney.page,
    "reloaded Chat snapshot retains reply, conflict notice and latest P2",
  );
  await conflictJourney.page.screenshot({ path: `${OUT}/plan-conflict.png` });
  await conflictJourney.context.close();

  proxy.reset();
  const ownershipJourney = await openPage();
  await send(ownershipJourney.page, "Alpha owns this Trip");
  await proxy.waitForCount(1);
  const owner = proxy.requests[0];
  await switchChat(ownershipJourney.page, "Rival");
  await send(ownershipJourney.page, "Rival must not send");
  await composer(ownershipJourney.page).blur();
  check(proxy.requests.length === 1, "a second Chat cannot request a Trip already in flight");
  await waitStored(
    ownershipJourney.page,
    (value, text) =>
      !value?.conversations
        ?.find((item) => item.id === "conversation:rival")
        ?.messages.some((message) => message.role === "user" && message.text === text),
    "Rival must not send",
  );
  check(
    (await ownershipJourney.page
      .locator(".msg-item--user")
      .getByText("Rival must not send", { exact: true })
      .count()) === 0,
    "a refused second Chat adds no user message",
  );
  check(
    (await composer(ownershipJourney.page).inputValue()) === "Rival must not send",
    "a refused send keeps the draft available",
  );
  owner.release(completedPlan, "Alpha owner completed");
  await within(owner.settled, "owner completion");
  await ownershipJourney.context.close();

  proxy.reset();
  const deleteChatJourney = await openPage();
  await send(deleteChatJourney.page, "Delete this Chat");
  await proxy.waitForCount(1);
  const deleteChat = proxy.requests[0];
  const chats = deleteChatJourney.page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Chats/ });
  if ((await chats.getAttribute("aria-expanded")) !== "true") await chats.click();
  const alphaRow = deleteChatJourney.page
    .locator(".history-item:not(.history-item--trip)")
    .filter({ hasText: "Alpha" })
    .first();
  await alphaRow.locator(".history-item__more").click();
  await deleteChatJourney.page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await deleteChatJourney.page
    .getByRole("dialog", { name: "Delete chat" })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await within(deleteChat.settled, "deleted Chat aborts its request");
  check(deleteChat.aborted, "deleting the owning Chat aborts generation");
  deleteChat.release(completedPlan, "Deleted Chat late reply");
  await within(deleteChat.settled, "deleted Chat late release");
  await waitStored(
    deleteChatJourney.page,
    (value) => !value?.conversations?.some((item) => item.id === "conversation:alpha"),
  );
  await deleteChatJourney.context.close();

  proxy.reset();
  const deleteTripJourney = await openPage();
  await send(deleteTripJourney.page, "Delete this Trip");
  await proxy.waitForCount(1);
  const deleteTrip = proxy.requests[0];
  await deleteTripJourney.page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Trips/ })
    .click();
  await deleteTripJourney.page
    .locator(".trip-cards")
    .getByRole("button", { name: "Actions for Alpha trip", exact: true })
    .click();
  await deleteTripJourney.page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await within(deleteTrip.settled, "deleted Trip aborts its request");
  check(deleteTrip.aborted, "deleting the owning Trip aborts generation");
  deleteTrip.release(completedPlan, "Deleted Trip late reply");
  await within(deleteTrip.settled, "deleted Trip late release");
  await waitStored(
    deleteTripJourney.page,
    (value) => !value?.trips?.some((item) => item.id === "trip:alpha"),
  );
  await deleteTripJourney.context.close();

  proxy.reset();
  const teardownJourney = await openPage();
  await send(teardownJourney.page, "Workspace teardown request");
  await proxy.waitForCount(1);
  const teardown = proxy.requests[0];
  await switchChat(teardownJourney.page, "Gamma");
  await send(teardownJourney.page, "Gamma teardown request");
  await proxy.waitForCount(2);
  const teardownGamma = proxy.requests[1];
  await teardownJourney.page.close();
  await within(teardown.settled, "workspace teardown aborts its request");
  await within(teardownGamma.settled, "workspace teardown aborts second Trip");
  check(
    teardown.aborted && teardownGamma.aborted,
    "leaving the workspace aborts every owned request through the logout teardown path",
  );
  await teardownJourney.context.close();

  const paths = {
    Trips: async (page) => {
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Trips/ })
        .click();
      await page.locator(".trip-cards").waitFor();
    },
    Calendar: async (page) => {
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Calendar/ })
        .click();
      await page.locator(".trips-page__tabs").waitFor();
    },
    Settings: async (page) => {
      await page.locator(".account-button__more").click();
      await page.getByRole("menuitem", { name: "Personalization", exact: true }).click();
      await page.locator(".settings-nav").waitFor();
    },
    Chat: async (page) => {
      await switchChat(page, "Beta");
      await page.getByText("Beta marker", { exact: true }).waitFor();
    },
    Trip: async (page) => {
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Trips/ })
        .click();
      await page
        .locator(".trip-cards")
        .getByRole("button", { name: /Gamma trip/ })
        .first()
        .click();
      await page.locator(".trip-home").waitFor();
    },
  };
  for (const [name, navigate] of Object.entries(paths)) {
    proxy.reset();
    const journey = await openPage();
    const { page } = journey;
    await send(page, `${name} ownership request`);
    await proxy.waitForCount(1);
    const request = proxy.requests[0];
    await waitForControlledProgress(page);
    await navigate(page);
    checkpoint(`${name}: pending off-page`, proxy);
    if (name === "Settings") await page.keyboard.press("Escape");
    await switchChat(page, "Alpha");
    await waitForControlledProgress(page);
    check(
      (await page
        .locator(".msg-item--user")
        .getByText(`${name} ownership request`, { exact: true })
        .count()) === 1,
      `${name}: pending return restores one message and streamed progress`,
    );
    await navigate(page);
    request.release(completedPlan, `${name} background result`);
    await within(request.settled, `${name} background completion`);
    await waitStored(
      page,
      (value, text) =>
        value?.conversations
          ?.find((item) => item.id === "conversation:alpha")
          ?.messages.some((item) => item.text === text),
      `${name} background result`,
    );
    if (name === "Settings") await page.keyboard.press("Escape");
    await switchChat(page, "Alpha");
    await page
      .locator(".msg-item--agent")
      .getByText(`${name} background result`, { exact: true })
      .waitFor();
    check(
      proxy.requests.length === 1 && !request.aborted,
      `${name}: completed return retains one request`,
    );
    await page.screenshot({ path: `${OUT}/ownership-${name.toLowerCase()}.png` });
    await journey.context.close();
  }

  proxy.reset();
  const phoneJourney = await openPage({ width: 390, height: 844 });
  check(
    (await phoneJourney.page.evaluate(() => document.documentElement.scrollWidth)) === 390,
    "phone viewport has no horizontal page scroll before generation states",
  );
  await send(phoneJourney.page, "Phone stop request");
  await proxy.waitForCount(1);
  const phoneStop = proxy.requests[0];
  await phoneJourney.page.getByRole("button", { name: "Stop planning" }).click();
  await within(phoneStop.settled, "phone Stop request settles");
  await phoneJourney.page
    .getByText("Planning stopped.", { exact: true })
    .waitFor({ timeout: WAIT });
  check(
    (await phoneJourney.page.getByText("Planning stopped.", { exact: true }).count()) === 1,
    "phone shows the stopped banner",
  );
  await phoneJourney.page.screenshot({ path: `${OUT}/phone-stopped.png` });
  await phoneJourney.context.close();

  proxy.reset();
  const phoneConflict = await openPage({ width: 390, height: 844 });
  await send(phoneConflict.page, "Phone conflict request");
  await proxy.waitForCount(1);
  const phoneConflictRequest = proxy.requests[0];
  await removeBaseStop(phoneConflict.page);
  await switchChat(phoneConflict.page, "Alpha");
  await waitForControlledProgress(phoneConflict.page);
  await assertLatestPlan(
    phoneConflict.page,
    "phone running Chat restores latest P2 before delayed completion",
  );
  phoneConflictRequest.release(
    plan({
      id: "alpha",
      destination: "Alpha",
      items: [stop("alpha-base", 1, "09:00")],
    }),
    "Phone generated reply despite edit",
  );
  await within(phoneConflictRequest.settled, "phone conflict completion");
  await switchChat(phoneConflict.page, "Alpha");
  await phoneConflict.page
    .getByText("Phone generated reply despite edit", { exact: true })
    .waitFor({ timeout: WAIT });
  await phoneConflict.page
    .getByText("The plan changed while this reply was being prepared. Your edits were kept.", {
      exact: true,
    })
    .waitFor({ timeout: WAIT });
  check(
    (await phoneConflict.page
      .getByText("The plan changed while this reply was being prepared. Your edits were kept.", {
        exact: true,
      })
      .count()) === 1,
    "phone shows the conflict notice",
  );
  await assertLatestPlan(phoneConflict.page, "phone conflict completion keeps visible P2");
  check(
    (await phoneConflict.page.evaluate(() => document.documentElement.scrollWidth)) === 390,
    "phone viewport has no horizontal page scroll after conflict notice",
  );
  await phoneConflict.page.screenshot({ path: `${OUT}/phone-conflict.png` });
  await phoneConflict.context.close();

  check(browserErrors.length === 0, "no unexpected browser page errors", browserErrors);
  check(externalRequests.length === 0, "no external browser requests", externalRequests);
} catch (error) {
  check(false, "controlled browser journey completes", String(error));
  const page = browser.contexts().at(-1)?.pages().at(-1);
  await page?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  const browserVersion = browser.version();
  await browser.close().catch(() => {});
  await proxy.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      {
        baseUrl: BASE.href,
        proxyUrl,
        browser: browserVersion,
        results,
        checkpoints,
        requestCount: proxy.history.length,
        requests: proxy.history.map(({ settled: _settled, ...entry }) => entry),
        browserErrors,
        externalRequests,
        assumptions: {
          controlledStream: "NDJSON progress is flushed before completion is released",
          fixture: "two Trips and four Chats seeded in browser workspace storage",
          durableExecution: "excluded by ticket",
        },
      },
      null,
      2,
    ),
  );
}

if (results.some((result) => !result.ok)) process.exitCode = 1;
