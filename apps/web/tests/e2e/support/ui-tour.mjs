import { EXAMPLE_CHIP_SELECTOR } from "./e2e-helpers.mjs";

export const VIEWS = {
  desktop: { width: 1440, height: 1000 },
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true },
};

export async function seedSettings(context, { language, appearance }) {
  await context.addInitScript(
    ({ language, appearance }) => {
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
          memberships: [],
          assistant: { style: "neutral", memory: true },
          dataMode: "mock",
          appearance,
          language,
          displayCurrency: "AUD",
          updatedAt: new Date(0).toISOString(),
        }),
      );
    },
    { language, appearance },
  );
}

const zh = (page) => page.evaluate(() => document.documentElement.lang === "zh-CN");
const name = async (page, en, cn) => ((await zh(page)) ? cn : en);
const exact = (text) => new RegExp(`^${text}`);

async function sidebar(page, en, cn) {
  await page
    .locator(".workspace-sidebar")
    .getByRole("button", { name: exact(await name(page, en, cn)) })
    .first()
    .click();
  await page.waitForTimeout(800);
}

async function phoneTab(page, en, cn) {
  await page
    .locator(".phone-tabbar")
    .getByRole("tab", { name: exact(await name(page, en, cn)) })
    .click();
  await page.waitForTimeout(800);
}

async function openSettings(page) {
  if (page.viewportSize().width <= 520) {
    await phoneTab(page, "Mine", "我的");
    await page
      .getByRole("button", {
        name: await name(page, "Settings & account", "设置与账户"),
        exact: true,
      })
      .click();
  } else {
    await page
      .locator('button[aria-label^="Account settings:"], button[aria-label^="账户设置："]')
      .filter({ visible: true })
      .first()
      .click();
  }
  return page.getByRole("dialog");
}

export async function planExampleTrip(page) {
  await page
    .getByRole("button", { name: /^(Not now|暂不)$/ })
    .click({ timeout: 4000 })
    .catch(() => {});
  await page.locator(EXAMPLE_CHIP_SELECTOR).first().click();
  await page
    .getByText(/Estimated total|预计总额/)
    .first()
    .waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
}

export const SCREENS = {
  desktop: [
    { id: "new-chat", open: async () => {} },
    { id: "chat-reply", open: planExampleTrip },
    {
      id: "think",
      open: async (page) => {
        await page
          .locator(".msg-item button", { hasText: /^(Think|思考)/ })
          .filter({ visible: true })
          .first()
          .click();
        await page.waitForTimeout(800);
      },
    },
    {
      id: "trip-panel",
      open: async (page) => {
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", { name: await name(page, "Open your trip", "打开你的行程") })
          .filter({ visible: true })
          .first()
          .click();
        await page.waitForTimeout(1000);
      },
    },
    { id: "trips", open: (page) => sidebar(page, "Trips", "行程") },
    { id: "calendar", open: (page) => sidebar(page, "Calendar", "日历") },
    {
      id: "calendar-month",
      open: async (page) => {
        await page
          .getByRole("button", { name: await name(page, "Month", "月"), exact: true })
          .filter({ visible: true })
          .first()
          .click();
        await page.waitForTimeout(800);
      },
    },
    { id: "trajectory", open: (page) => sidebar(page, "Trajectory", "轨迹") },
    ...[1, 2, 3, 4].map((tab) => ({
      id: `settings-${tab}`,
      open: async (page) => {
        const dialog = page.getByRole("dialog");
        if (!(await dialog.isVisible())) await openSettings(page);
        await dialog
          .getByRole("tab")
          .nth(tab - 1)
          .click();
        await page.waitForTimeout(500);
      },
    })),
  ],
  phone: [
    { id: "new-chat", open: async () => {} },
    { id: "chat-reply", open: planExampleTrip },
    { id: "map", open: (page) => phoneTab(page, "Map", "地图") },
    { id: "trip", open: (page) => phoneTab(page, "Trip", "行程") },
    { id: "mine", open: (page) => phoneTab(page, "Mine", "我的") },
    {
      id: "settings",
      open: async (page) => {
        await openSettings(page);
        await page.waitForTimeout(500);
      },
    },
  ],
};

export async function walk(browser, { view, language, appearance, baseUrl }, onScreen) {
  const context = await browser.newContext({
    viewport: { width: VIEWS[view].width, height: VIEWS[view].height },
    isMobile: VIEWS[view].isMobile,
    hasTouch: VIEWS[view].hasTouch,
    locale: language === "zh" ? "zh-CN" : "en-AU",
    colorScheme: appearance,
  });
  await seedSettings(context, { language, appearance });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.locator(EXAMPLE_CHIP_SELECTOR).first().waitFor({ timeout: 60_000 });
  const missed = [];
  for (const screen of SCREENS[view]) {
    try {
      await screen.open(page);
      await onScreen(page, screen);
    } catch (error) {
      missed.push({ id: screen.id, error: String(error).split("\n")[0] });
    }
  }
  await context.close();
  return { missed, errors };
}
