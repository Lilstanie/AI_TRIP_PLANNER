export const BUDGET_CHIP_FILTER = { hasText: "Budget" };

export function normalizeText(text) {
  return text.replace(/\s+/g, " ");
}

export const EXAMPLE_CHIP_SELECTOR = ".chat-empty__suggestions button";

export async function openTripWorkspace(page, card) {
  await card.click();
  await page.locator(".trip-home").waitFor();
  await page.locator(".trip-home-chats__row").first().click();
  if (page.viewportSize().width <= 520) await page.locator(".phone-tabbar").waitFor();
}

export async function setDesktopLanguage(page, language) {
  await page
    .locator('button[aria-label^="Account settings:"], button[aria-label^="账户设置："]')
    .filter({ visible: true })
    .first()
    .click();
  const settings = page.getByRole("dialog");
  await settings.getByRole("tab", { name: /^(Language & region|语言与地区)$/ }).click();
  await settings.getByRole("button", { name: /^(Change Language|更改 语言)$/ }).click();
  await settings
    .getByRole("group", { name: /^(Language|语言)$/ })
    .getByRole("button", { name: language === "zh" ? "简体中文" : "English", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await settings.waitFor({ state: "hidden" });
}
