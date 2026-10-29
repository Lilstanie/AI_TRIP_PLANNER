import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/liquid-glass");
mkdirSync(OUT, { recursive: true });

const failures = [];
const records = [];
const check = (ok, message) => {
  records.push({ label: message, passed: !!ok });
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const material = (page, selector) =>
  page.evaluate((target) => {
    const [base, pseudo] = target.split("::");
    const element = [...document.querySelectorAll(base)].find((el) => el.getClientRects().length);
    if (!element) return null;
    const style = getComputedStyle(element, pseudo ? `::${pseudo}` : null);
    const alpha = style.backgroundColor.match(/rgba\([^)]*,\s*([\d.]+)\)/);
    return {
      blur: style.backdropFilter.includes("blur"),
      opaque: !alpha || Number(alpha[1]) === 1,
      background: style.backgroundColor,
    };
  }, selector);

const expectGlass = async (page, tag, name, selector) => {
  const found = await material(page, selector);
  check(found?.blur, `${tag}: ${name} is glass`);
};
const expectSolid = async (page, tag, name, selector) => {
  const found = await material(page, selector);
  check(found && !found.blur && found.opaque, `${tag}: ${name} is solid`);
};
const expectFallback = async (page, context, tag, scheme, surfaces) => {
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: scheme },
      { name: "prefers-reduced-transparency", value: "reduce" },
    ],
  });
  await page.waitForTimeout(400);
  for (const [name, selector] of surfaces) {
    const found = await material(page, selector);
    check(
      found && !found.blur && found.opaque,
      `${tag}: reduced transparency renders ${name} solid`,
    );
  }
  await shot(page, `${tag}-reduced-transparency`);
  await session.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: scheme },
      { name: "prefers-reduced-transparency", value: "no-preference" },
    ],
  });
  await session.detach();
};

async function open(browser, { width, height, scheme, video }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
    deviceScaleFactor: 2,
    ...(video ? { recordVideo: { dir: OUT, size: { width, height } } } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

  const live = page.getByRole("button", { name: /Live data/ });
  if (await live.count()) {
    if (width <= 520) await page.getByRole("tab", { name: "Mine", exact: true }).click();
    await live.click();
    if (width <= 520) await page.getByRole("tab", { name: "Chat", exact: true }).click();
  }
  return { context, page, errors };
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const settle = (page, ms = 600) => page.waitForTimeout(ms);
const noSideScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function desktop(browser, scheme) {
  const { context, page, errors } = await open(browser, {
    width: 1440,
    height: 900,
    scheme,
    video: scheme === "light",
  });
  const tag = `desktop-${scheme}`;
  await settle(page);
  await shot(page, `${tag}-01-blank`);
  await expectGlass(page, tag, "sidebar", ".workspace-sidebar");

  await page.getByRole("button", { name: /^Chats/ }).click();
  await settle(page, 500);
  await shot(page, `${tag}-02-chats-panel`);
  await expectGlass(page, tag, "Chats panel", ".chats-panel.is-open");
  await page.keyboard.press("Escape");
  await settle(page, 400);
  check(
    await page.evaluate(
      () => getComputedStyle(document.querySelector(".chats-panel")).viewTransitionName === "none",
    ),
    `${tag}: closed Chats panel is not captured by view transitions`,
  );

  await page.getByRole("button", { name: /^Chats/ }).click();
  await settle(page, 400);
  await page.locator(".sidebar-nav").getByRole("button", { name: "New chat", exact: true }).click();
  await settle(page, 700);
  await page.locator(".chat-empty__suggestions button").first().click();
  await page
    .locator(".msg-item--agent .msg-item__body")
    .first()
    .waitFor({ timeout: 120_000 })
    .catch(() => undefined);
  await settle(page, 2500);
  await shot(page, `${tag}-03-planned`);
  await expectSolid(page, tag, "chat bubble", ".msg-item__bubble");

  await page.locator(".fact-chip").nth(1).click();
  await settle(page, 500);
  await shot(page, `${tag}-04-when-sheet`);
  await expectGlass(page, tag, "When sheet", ".fact-popover");
  await expectFallback(page, context, `${tag}-sheet`, scheme, [["When sheet", ".fact-popover"]]);
  await page.keyboard.press("Escape");
  await settle(page, 300);
  check(!(await page.locator(".fact-popover").count()), `${tag}: When sheet closes`);

  await page.getByRole("button", { name: "Open your trip" }).click();
  await settle(page, 700);
  await shot(page, `${tag}-05-trip-drawer`);
  const timeline = page.getByRole("tab", { name: /Timeline/ });
  if (await timeline.count()) {
    await timeline.click();
    await settle(page, 600);
    await shot(page, `${tag}-06-trip-timeline`);
  }
  await page.keyboard.press("Escape");
  await settle(page, 500);
  check(
    !(await page.locator(".workspace-drawer-backdrop").count()),
    `${tag}: backdrop leaves after its fade`,
  );

  await page.getByRole("button", { name: /^Trips/ }).click();
  await settle(page, 700);
  await shot(page, `${tag}-07-your-trips`);
  await expectSolid(page, tag, "trip card caption", ".trip-card__text");
  const calendar = page.getByRole("tab", { name: "Calendar" });
  await calendar.click();
  await settle(page, 500);
  check(
    (await page.locator(".trips-page__tabs").getAttribute("data-segmented")) === "ready",
    `${tag}: segmented thumb is placed`,
  );
  await shot(page, `${tag}-08-calendar`);
  await expectSolid(page, tag, "calendar grid", ".trip-calendar__grid");

  await expectFallback(page, context, tag, scheme, [["sidebar", ".workspace-sidebar"]]);
  check(await noSideScroll(page), `${tag}: no horizontal page scroll`);
  check(
    !errors.length,
    `${tag}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
  );
  await context.close();
}

async function map(browser, scheme) {
  const { context, page, errors } = await open(browser, { width: 1000, height: 800, scheme });
  const tag = `map-${scheme}`;
  const response = await page.goto(`${BASE}/debug/map`);
  if (response?.status() === 404) {
    console.log(`skip ${tag}: debug map is intentionally unavailable in production`);
    await context.close();
    return;
  }
  await page.waitForSelector(".trip-map-marker", { timeout: 30_000 }).catch(() => undefined);
  await settle(page, 2500);
  await shot(page, `${tag}-01-routes`);

  if (
    !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY &&
    !(await page.locator(".trip-map-marker").count()) &&
    (await page.locator(".trip-map-fallback").isVisible())
  ) {
    check(
      (await page.locator(".trip-map-fallback ol li").count()) === 8,
      `${tag}: no-key fallback lists eight stops`,
    );
    check(await noSideScroll(page), `${tag}: fallback has no horizontal scroll`);
    check(
      !errors.length,
      `${tag}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
    );
    console.log(`skip ${tag}: live tiles/marker/controls require a browser Maps key`);
    await context.close();
    return;
  }
  check((await page.locator(".trip-map-marker").count()) === 8, `${tag}: eight stops are marked`);
  const tileFailure = page.locator(".trip-map-fallback");
  if (await tileFailure.isVisible()) {
    console.log(
      `skip ${tag}: map controls need tiles, and the map reports ${JSON.stringify(
        (await tileFailure.locator("p").first().innerText()).trim(),
      )}`,
    );
    await context.close();
    return;
  }
  const controls = page.getByRole("group", { name: "Map controls" });
  const box = await controls.boundingBox();
  check(!!box && box.x > 800 && box.y > 450, `${tag}: map controls sit bottom-right`);
  check(
    !(await page.getByRole("button", { name: "View all places" }).count()),
    `${tag}: no View all places button`,
  );
  const layers = page.getByRole("button", { name: "Satellite view" });
  if (await layers.isDisabled()) {
    check(
      !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      `${tag}: satellite is disabled only without a Google Maps key`,
    );
    console.log(`skip ${tag}: satellite view requires Google Maps; OSM tiles have no imagery`);
  } else {
    await layers.click();
    await settle(page, 1500);
    check((await layers.getAttribute("aria-pressed")) === "true", `${tag}: satellite toggles on`);
    await shot(page, `${tag}-02-satellite`);
  }
  await page.getByRole("button", { name: "Zoom in" }).click();
  await settle(page, 800);
  check(
    !errors.length,
    `${tag}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
  );
  await context.close();
}

async function phone(browser, scheme) {
  const { context, page, errors } = await open(browser, { width: 390, height: 844, scheme });
  const tag = `phone-${scheme}`;
  await settle(page);
  await shot(page, `${tag}-01-chat`);
  await expectGlass(page, tag, "top bar", ".workspace-topbar::before");
  await expectGlass(page, tag, "tab bar", ".phone-tabbar");
  await page.locator(".chat-suggestions__chip").first().click();
  await page
    .locator(".msg-item--agent .msg-item__body")
    .first()
    .waitFor({ timeout: 120_000 })
    .catch(() => undefined);
  await settle(page, 2500);
  await shot(page, `${tag}-02-planned`);
  await expectSolid(page, tag, "chat bubble", ".msg-item__bubble");
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await settle(page, 800);
  await shot(page, `${tag}-03-map`);
  await expectGlass(page, tag, "Day stops sheet", ".phone-map-sheet");
  await expectFallback(page, context, `${tag}-map`, scheme, [
    ["top bar", ".workspace-topbar::before"],
    ["tab bar", ".phone-tabbar"],
    ["Day stops sheet", ".phone-map-sheet"],
  ]);
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await settle(page, 400);
  await page.locator(".phone-topbar__title-button").click();
  await page.locator('.facts-sheet__row[data-fact="who"]').click();
  await settle(page, 600);
  await shot(page, `${tag}-04-who-sheet`);
  await expectGlass(page, tag, "Who sheet", ".fact-popover");
  await page.keyboard.press("Escape");
  await settle(page, 400);
  await page.getByRole("tab", { name: "Mine", exact: true }).click();
  await settle(page, 600);
  await shot(page, `${tag}-05-navigation`);
  check(await noSideScroll(page), `${tag}: no horizontal page scroll`);
  check(
    !errors.length,
    `${tag}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
  );
  await context.close();
}

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
try {
  for (const scheme of ["light", "dark"]) {
    await desktop(browser, scheme);
    await map(browser, scheme);
    await phone(browser, scheme);
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(records, null, 2));
console.log(`\nArtifacts: ${OUT}`);
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
