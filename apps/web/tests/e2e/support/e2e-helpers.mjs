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
