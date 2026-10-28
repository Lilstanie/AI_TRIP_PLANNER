export const BUDGET_CHIP_FILTER = { hasText: "Budget" };

export function normalizeText(text) {
  return text.replace(/\s+/g, " ");
}

export const EXAMPLE_CHIP_SELECTOR = ".chat-empty__suggestions button";

export async function openTripWorkspace(page, card) {
  const name = (await card.locator(".trip-card__title").innerText()).trim();
  await card.click();
  if (page.viewportSize().width <= 520) return;
  await page.locator(".trip-home").waitFor();
  if (page.viewportSize().width <= 1000) {
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await page
      .locator(".drawer .history-item:not(.history-item--trip)")
      .filter({ hasText: name })
      .first()
      .locator(".history-item__open")
      .click();
    return;
  }
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^(Chats|聊天)/ })
    .click();
  await page
    .locator(".chats-panel.is-open .history-item:not(.history-item--trip)")
    .filter({ hasText: name })
    .first()
    .locator(".history-item__open")
    .click();
}
