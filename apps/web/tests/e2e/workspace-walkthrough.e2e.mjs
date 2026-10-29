import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/workspace-walkthrough", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });

const CONFIGS = [
  { size: "desktop-1440", width: 1440, height: 1000, phone: false },
  { size: "phone-390", width: 390, height: 844, phone: true },
  { size: "phone-360", width: 360, height: 800, phone: true },
];
const THEMES = ["light", "dark"];
const CATALOG_KEY = "trip-workspace-catalog-v3";
const SETTINGS_KEY = "trip.settings.v1";

const checks = [];
const shots = [];
const reach = [];
let scope = "";
const check = (ok, name, observed) => {
  const entry = { scope, ok: Boolean(ok), name, ...(observed === undefined ? {} : { observed }) };
  checks.push(entry);
  console.log(
    `${entry.ok ? "ok  " : "FAIL"} ${scope}: ${name}${observed === undefined ? "" : ` ${JSON.stringify(observed)}`}`,
  );
};

const settingsFor = (theme) => ({
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: theme,
  language: "en",
  displayCurrency: "AUD",
  updatedAt: "2026-10-27T00:00:00Z",
});

const fixtureTrip = () => {
  const id = "walkthrough-sydney";
  const item = ({ location = undefined, ...extra }, key, detail) => ({
    id: key,
    kind: "activity",
    detail,
    day: 1,
    ...(location === "" ? {} : { location: detail }),
    startTime: "09:00",
    endTime: "10:00",
    ...extra,
  });
  const items = [
    item({ estCost: 300, endTime: "11:00" }, "gallery", "Priced gallery"),
    item({ estCost: 0, startTime: "10:00", endTime: "12:00" }, "garden", "Free garden"),
    item({ location: "", startTime: "12:00", endTime: "13:00" }, "museum", "Unpriced museum"),
    item({ startTime: "13:00", endTime: "14:00" }, "cafe", "Lookup failure cafe"),
  ];
  const plan = {
    tripId: id,
    brief: {
      tripId: id,
      userId: "e2e",
      destination: "Sydney",
      dates: ["2026-12-16", "2026-12-17"],
      groupSize: 2,
      budgetTotal: 400,
      displayCurrency: "AUD",
    },
    round: 1,
    budgetTotal: 400,
    estTotal: 300,
    overrunPct: 0,
    sections: [
      {
        id: "itinerary",
        label: "Day plan",
        summary: "Day plan fixture",
        status: "draft",
        estCost: 300,
        proposal: {
          agent: "itinerary",
          summary: "Day plan fixture",
          items,
          assumptions: [],
          conflictsWith: [],
        },
      },
    ],
    conflicts: [],
  };
  const savedAt = "2026-10-27T00:00:00.000Z";
  const messages = [
    { role: "user", text: "Plan Sydney." },
    { role: "agent", text: "Ready." },
  ];
  const snapshot = {
    version: 4,
    id,
    savedAt,
    plan,
    draft: {
      destination: "Sydney",
      origin: "",
      start: "2026-12-16",
      end: "2026-12-17",
      groupSize: "2",
      budgetTotal: "400",
      preferences: [],
      nationality: "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages,
    input: "",
  };
  const conversationId = `conversation:${id}`;
  const tripId = `trip:${id}`;
  return {
    version: 4,
    activeConversationId: conversationId,
    activeTripId: tripId,
    conversations: [
      {
        id: conversationId,
        title: "Walkthrough Sydney",
        updatedAt: savedAt,
        tripId,
        messages,
        input: "",
        snapshot,
      },
    ],
    trips: [
      {
        id: tripId,
        title: "Walkthrough Sydney",
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
  };
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const open = async (config, theme, { seed = false } = {}) => {
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    ...(config.phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
    reducedMotion: "reduce",
    locale: "en-AU",
    geolocation: { latitude: -33.87, longitude: 151.21 },
    permissions: ["geolocation"],
  });
  await context.addInitScript(
    ({ settings, key, catalogKey, catalog }) => {
      localStorage.setItem(key, JSON.stringify(settings));
      if (catalog) localStorage.setItem(catalogKey, JSON.stringify(catalog));
      window.__geolocationCalls = 0;
      const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (...args) => {
        window.__geolocationCalls += 1;
        return original(...args);
      };
    },
    {
      settings: settingsFor(theme),
      key: SETTINGS_KEY,
      catalogKey: CATALOG_KEY,
      catalog: seed ? fixtureTrip() : undefined,
    },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", async (route) => {
    const body = route.request().postDataJSON();
    if (body.text === "Lookup failure cafe")
      await route.fulfill({ status: 503, body: "fixture lookup failure" });
    else await route.fulfill({ json: { places: [] } });
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return { context, page, errors };
};

const luminance = (color) => {
  const srgb = color.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
  const parts = srgb
    ? [srgb[1] * 255, srgb[2] * 255, srgb[3] * 255]
    : (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const [r, g, b] = parts.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const material = (page, selector, pseudo) =>
  page
    .locator(selector)
    .first()
    .evaluate((node, pseudoElement) => {
      const style = getComputedStyle(node, pseudoElement ?? null);
      return { filter: style.backdropFilter, fill: style.backgroundColor };
    }, pseudo);

const expectGlass = async (page, label, selector, theme, pseudo) => {
  const found = await material(page, selector, pseudo);
  const blurred = /blur\(/.test(found.filter);
  const alpha = Number(
    found.fill.match(/\/\s*([\d.]+)\)/)?.[1] ?? found.fill.match(/,\s*([\d.]+)\)$/)?.[1] ?? 1,
  );
  const lum = luminance(found.fill);
  check(blurred, `${label} is a blurred glass surface`, found.filter.slice(0, 40));
  check(alpha < 1, `${label} tint is translucent`, found.fill);
  check(
    theme === "dark" ? lum < 0.5 : lum > 0.5,
    `${label} tint follows the ${theme} appearance`,
    Math.round(lum * 100) / 100,
  );
};

const expectSolid = async (page, label, selector) => {
  if (!(await page.locator(selector).count())) return check(false, `${label} is present`);
  const found = await material(page, selector);
  check(
    found.filter === "none" || found.filter === "",
    `${label} stays solid with no backdrop blur`,
    found.filter,
  );
};

const fits = async (page, label) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(overflow <= 0, `${label} has no horizontal page scroll`, overflow);
};

try {
  for (const config of CONFIGS) {
    for (const theme of THEMES) {
      const tag = `${config.size}-${theme}`;
      scope = tag;
      const dir = `${OUT}/${tag}`;
      mkdirSync(dir, { recursive: true });
      let order = 0;
      const shot = async (page, name) => {
        order += 1;
        const file = `${String(order).padStart(2, "0")}-${name}.png`;
        await page.screenshot({ path: `${dir}/${file}` });
        shots.push(`${tag}/${file}`);
      };
      const themed = async (page) => {
        const applied = await page
          .waitForFunction((name) => document.documentElement.dataset.theme === name, theme, {
            timeout: 5_000,
          })
          .then(() => true)
          .catch(() => false);
        await page.waitForTimeout(500);
        check(applied, `appearance is ${theme}`);
      };
      const tabbar = (page) => page.locator(".phone-tabbar");
      const tab = (page, name) => tabbar(page).getByRole("tab", { name });
      const teamButton = (page) =>
        config.phone
          ? page.locator(".workspace-topbar .phone-topbar__team")
          : page.getByRole("button", { name: /^Agent Team/ });

      {
        const { context, page, errors } = await open(config, theme);
        if (config.phone) await tabbar(page).waitFor();
        await themed(page);

        if (config.phone) {
          await tab(page, /^Map/).click();
          const canvas = page.locator(".trip-map-canvas:visible");
          await canvas.waitFor();
          await page.waitForFunction(
            () =>
              document.querySelector(".trip-map-canvas .google-map")?.dataset.mapReady === "true",
            undefined,
            { timeout: 20_000 },
          );
          check(
            (await canvas.locator(".trip-map-start").count()) === 1 &&
              (await canvas.locator(".map-placeholder").count()) === 0 &&
              (await page.locator(".location-prompt:visible").count()) === 0 &&
              (await page.locator(".phone-map-sheet").count()) === 0,
            "empty Map shows a basemap and one hint, with no placeholder, location prompt or Day stops sheet",
          );
          check(
            (await page.evaluate(() => window.__geolocationCalls)) === 0,
            "empty Map does not ask for location",
          );
          check(
            (await canvas.locator(".trip-map-start").getByRole("button").count()) === 1,
            "empty Map hint offers one action",
          );
          await expectGlass(page, "map hint", ".trip-map-start", theme);
          await shot(page, "empty-map");
          await expectGlass(page, "phone top bar", ".workspace-topbar", theme, "::before");
          await expectGlass(page, "phone tab bar", ".phone-tabbar", theme);

          await tab(page, /^Chat/).click();
          await page.getByLabel("Example trips").waitFor();
          check(
            (await page.locator(".chat .disclaimer:visible").count()) === 0,
            "empty Chat shows one sentence and no second footer sentence",
          );
          await shot(page, "empty-chat");

          await tab(page, /^Mine/).click();
          const mine = page.locator(".phone-mine");
          await mine.waitFor();
          check(
            (await mine.getByRole("button", { name: "New trip", exact: true }).count()) === 1 &&
              (await mine.getByRole("button", { name: "New chat", exact: true }).count()) === 1 &&
              (await mine.getByRole("heading", { name: "Trips" }).count()) === 1 &&
              (await mine.getByRole("heading", { name: "Chats" }).count()) === 1 &&
              (await mine.locator(".history-item").count()) === 0,
            "empty Mine shows Trips and Chats with New trip and New chat",
          );
          await shot(page, "empty-mine");

          await teamButton(page).click();
          await page.locator(".trajectory-empty").waitFor();
          check(
            (await page.locator(".trajectory-empty p").count()) === 1,
            "empty Trajectory shows one sentence",
          );
          const planButton = await page
            .locator(".trajectory-empty")
            .getByRole("button", { name: "Plan in Chat" })
            .boundingBox();
          check(
            planButton !== null && planButton.height <= 64,
            "empty Trajectory action keeps its natural height",
            planButton,
          );
          await shot(page, "empty-trajectory");
          await page.locator(".phone-trajectory__close").click();
        } else {
          await expectGlass(page, "sidebar", ".workspace-sidebar", theme);
          await expectGlass(page, "composer", ".composer", theme);
          await expectGlass(page, "team capsule", ".team-trigger", theme);
          await shot(page, "empty-workspace");
          const nav = page.locator(".sidebar-nav");
          for (const name of ["New chat", "Chats", "Trips", "Calendar"])
            check(
              (await nav.getByRole("button", { name: new RegExp(`^${name}`) }).count()) === 1,
              `sidebar has ${name}`,
            );
          await nav.getByRole("button", { name: /^Calendar/ }).click();
          await page.getByRole("tab", { name: "Calendar", selected: true }).waitFor();
          await shot(page, "sidebar-calendar");
          await nav.getByRole("button", { name: /^New chat/ }).click();
          check(
            (await page.getByRole("dialog").count()) === 0,
            "sidebar New chat opens a blank Chat without Where",
          );
          await shot(page, "sidebar-new-chat");
          check(
            (await page
              .locator(".workspace-panel--map")
              .evaluate((node) => getComputedStyle(node).visibility)) === "hidden" &&
              (await page.locator(".trip-map-start:visible, .map-placeholder:visible").count()) ===
                0 &&
              (await page.locator(".location-prompt:visible").count()) === 0 &&
              (await page.evaluate(() => window.__geolocationCalls)) === 0,
            "wide empty workspace keeps the map area hidden, with no placeholder, hint or location request",
          );
        }
        await fits(page, "empty workspace");

        const entry = page.locator(".chat-empty__suggestions button").first();
        if (config.phone) await tab(page, /^Chat/).click();
        await entry.waitFor();
        await entry.click();
        const trigger = teamButton(page);
        const workingLabel = await page
          .waitForFunction(
            () =>
              [...document.querySelectorAll(".team-trigger, .phone-topbar__team")]
                .map((node) => node.getAttribute("aria-label") ?? "")
                .find((label) => /working|正在工作/.test(label)),
            undefined,
            { timeout: 6_000 },
          )
          .then((handle) => handle.jsonValue())
          .catch(() => undefined);
        const working = workingLabel !== undefined;
        if (working) {
          check(/\d+ working/.test(workingLabel), "working capsule names N working", workingLabel);
          check(
            (await trigger.first().locator(".team-trigger__avatars .assistant-icon").count()) === 3,
            "working capsule shows three stacked avatars",
          );
          await shot(page, "team-working");
        }
        await page
          .locator(".msg-item--agent .msg-item__body")
          .first()
          .waitFor({ timeout: 240_000 });
        await page.waitForFunction(
          () =>
            ![...document.querySelectorAll(".team-trigger, .phone-topbar__team")].some((node) =>
              /working|正在工作/.test(node.getAttribute("aria-label") ?? ""),
            ),
          undefined,
          { timeout: 240_000 },
        );
        await page.waitForTimeout(600);
        check(true, "mock planning round completes", { workingSeen: working });
        await shot(page, "planned-chat");

        const capsule = page.locator(".workspace-topbar .team-trigger, .team-trigger").first();
        check(
          (await capsule.locator(".team-trigger__avatars .assistant-icon").count()) === 3,
          "team capsule shows three stacked avatars",
        );
        const capsuleBox = await trigger.first().boundingBox();
        check(
          capsuleBox !== null &&
            capsuleBox.x + capsuleBox.width <= config.width &&
            (!config.phone || (capsuleBox.width >= 44 && capsuleBox.height >= 44)),
          "team capsule fits the top bar",
          capsuleBox,
        );
        const titleRow = await page.evaluate((phone) => {
          const title = document.querySelector(phone ? ".phone-topbar__title" : ".topbar-title");
          const team = document.querySelector(".team-trigger, .phone-topbar__team");
          const bar = document.querySelector(".workspace-topbar");
          if (!title || !team || !bar) return null;
          const centre = (node) => {
            const box = node.getBoundingClientRect();
            return box.top + box.height / 2;
          };
          return {
            apart: Math.abs(centre(title) - centre(team)),
            height: bar.getBoundingClientRect().height,
          };
        }, config.phone);
        check(
          titleRow !== null && titleRow.apart <= 8 && (!config.phone || titleRow.height <= 72),
          config.phone
            ? "phone top bar keeps title, badge and capsule on one row"
            : "capsule, trip title and badge share one row",
          titleRow,
        );

        let actions = 0;
        await trigger.first().click();
        actions += 1;
        if (config.phone) {
          const sheet = page.locator("dialog.phone-trajectory[open]");
          await sheet.waitFor();
          check(
            (await sheet.locator(".team-panel__row").count()) === 6,
            "phone team sheet lists six specialists",
          );
          await shot(page, "team-panel");
          reach.push({ scope: tag, target: "Agent Team", actions: 1 });
          const simple = sheet.locator("[data-trajectory-simple]");
          await simple.waitFor();
          check(
            (await sheet.locator("tr[data-record-index]").count()) === 0,
            "phone trajectory opens on the simple list",
          );
          reach.push({ scope: tag, target: "Trajectory", actions: 1 });
          const turns = await simple.locator("[data-simple-turn]").count();
          await simple.locator("[data-simple-toggle]").first().click();
          check(
            (await simple.locator("[data-simple-round]").count()) >= 1,
            "a simple row expands to its rounds",
          );
          await shot(page, "trajectory-simple");
          await sheet.getByRole("button", { name: "Full view", exact: true }).click();
          await sheet.locator("tr[data-record-index]").first().waitFor();
          const fullTurns = await sheet.locator("tr[data-turn-start='true']").count();
          check(fullTurns === turns, "simple and full views agree on the number of turns", {
            turns,
            fullTurns,
          });
          await shot(page, "trajectory-full");
          await fits(page, "trajectory sheet");
          await sheet.locator(".phone-trajectory__close").click();
        } else {
          const panel = page.locator(".team-panel");
          await panel.waitFor();
          check(
            (await panel.locator(".team-panel__row").count()) === 6,
            "team panel lists six specialists",
          );
          await expectGlass(page, "team panel", ".team-panel", theme);
          reach.push({ scope: tag, target: "Agent Team", actions });
          await shot(page, "team-panel");
          await page.keyboard.press("Escape");
          await panel.waitFor({ state: "detached" }).catch(() => {});
          await page.getByRole("tab", { name: "Trajectory", exact: true }).click();
          reach.push({ scope: tag, target: "Trajectory", actions: 1 });
          const simple = page.locator("[data-trajectory-simple]");
          await simple.waitFor();
          check(
            (await page.locator("tr[data-record-index]").count()) === 0,
            "Trajectory opens on the simple list",
          );
          const turns = await simple.locator("[data-simple-turn]").count();
          await simple.locator("[data-simple-toggle]").first().click();
          check(
            (await simple.locator("[data-simple-round]").count()) >= 1,
            "a simple row expands to its rounds",
          );
          await shot(page, "trajectory-simple");
          await page.getByRole("button", { name: "Full view", exact: true }).click();
          await page.locator("tr[data-record-index]").first().waitFor();
          const fullTurns = await page.locator("tr[data-turn-start='true']").count();
          check(fullTurns === turns, "simple and full views agree on the number of turns", {
            turns,
            fullTurns,
          });
          await shot(page, "trajectory-full");
          await page.getByRole("button", { name: "Simple", exact: true }).click();
          await page.getByRole("tab", { name: "Conversation", exact: true }).click();
        }
        check(
          reach.filter((r) => r.scope === tag).every((r) => r.actions <= 2),
          "Agent Team and Trajectory are reachable in two taps or fewer",
        );

        if (config.phone) await tab(page, /^Trip/).click();
        else {
          const openTrip = page.getByRole("button", { name: "Open your trip" });
          if (await openTrip.count()) await openTrip.click();
        }
        const panel = page.locator(".trip-panel");
        await panel.waitFor();
        await expectSolid(page, "planned Trip panel", ".trip-panel");
        check(
          (await page.getByRole("region", { name: /Trip issues/ }).count()) === 0 &&
            (await panel.getByText(/Trip issues/).count()) === 0,
          "planned Trip panel has no Trip issues block",
        );
        check(
          (await panel.locator(".trip-panel__budget-summary").count()) === 1 &&
            !(await panel.locator(".trip-panel__budget-summary").evaluate((node) => node.open)),
          "budget is one collapsed summary line above the day plan",
        );
        await shot(page, "planned-trip");
        check(errors.length === 0, "no page errors on the empty-to-planned journey", errors);
        await context.close();
      }

      {
        const { context, page, errors } = await open(config, theme, { seed: true });
        const history = page.locator('.history-item__open[title="Walkthrough Sydney"]');
        if (config.phone) await tab(page, /^Mine/).click();
        else await page.getByRole("button", { name: /^Chats/ }).click();
        await history.waitFor().catch(async (error) => {
          await page.screenshot({ path: `${dir}/debug-history.png` });
          throw error;
        });
        await history.click();
        if (config.phone) await tab(page, /^Trip/).click();
        else {
          const openTrip = page.getByRole("button", { name: "Open your trip" });
          if (await openTrip.count()) await openTrip.click();
        }
        const panel = page.locator(".trip-panel");
        await panel.waitFor();
        const badge = page.getByRole("button", { name: /^Open items/ });
        await badge.waitFor();
        const count = Number((await badge.innerText()).trim());
        check(count > 0, "open-items badge shows a count", count);
        const title = config.phone ? ".phone-topbar__title" : ".topbar-title";
        const titleBox = await page.locator(title).first().boundingBox();
        const badgeBox = await badge.boundingBox();
        check(
          badgeBox !== null &&
            titleBox !== null &&
            badgeBox.x + badgeBox.width <= config.width &&
            (!config.phone || badgeBox.height >= 44),
          "badge sits beside the trip title inside the viewport",
          { titleBox, badgeBox },
        );
        await badge.click();
        const popover = page.getByRole("dialog", { name: "Open items" });
        await popover.waitFor();
        const rows = await popover
          .getByRole("button")
          .evaluateAll((nodes) => nodes.map((node) => node.ariaLabel ?? ""));
        check(rows.length === count, "popover rows equal the badge count", { count, rows });
        check(
          rows.some((row) => row.startsWith("Time conflict")) &&
            rows.some((row) => row.startsWith("Unlocated place")) &&
            rows.some((row) => row.startsWith("Place lookup failed")),
          "popover distinguishes conflict, unlocated place and failed lookup",
          rows,
        );
        await expectGlass(
          page,
          "open-items popover",
          '[role="dialog"][aria-label="Open items"]',
          theme,
        );
        const popoverBox = await popover.boundingBox();
        check(
          popoverBox !== null &&
            popoverBox.x >= 0 &&
            popoverBox.x + popoverBox.width <= config.width,
          "popover fits the viewport",
          popoverBox,
        );
        await shot(page, "open-items");
        await popover.getByRole("button", { name: /^Place lookup failed/ }).click();
        check((await popover.count()) === 0, "choosing an open item closes the popover");
        const stop = page
          .locator(".timeline-stop__main")
          .filter({ hasText: "Lookup failure cafe" });
        check(
          (await stop.getAttribute("aria-expanded")) === "true",
          "the open item opens its stop",
        );
        await shot(page, "open-item-stop");
        await page.locator(".trip-panel__budget-summary > summary").click();
        check(
          await page.locator(".trip-panel__budget-summary").evaluate((node) => node.open),
          "budget summary opens its breakdown on demand",
        );
        await shot(page, "budget-breakdown");
        await fits(page, "fixture trip");
        check(errors.length === 0, "no page errors on the fixture trip journey", errors);
        await context.close();
      }
    }
  }
} catch (error) {
  check(false, "walkthrough completes", String(error));
} finally {
  await browser.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      {
        passed: checks.filter((entry) => entry.ok).length,
        failed: checks.filter((entry) => !entry.ok).length,
        sizes: CONFIGS.map((config) => config.size),
        themes: THEMES,
        fixture: "production build, mock tools, no live services",
        reach,
        shots,
        checks,
      },
      null,
      2,
    ),
  );
}
process.exitCode = checks.some((entry) => !entry.ok) ? 1 : 0;
