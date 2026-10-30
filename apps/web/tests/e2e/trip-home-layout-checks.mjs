export async function checkHomeLayout(page, check) {
  const layout = await page.locator(".trip-home").evaluate((home) => {
    const shell = home.closest(".workspace-shell").getBoundingClientRect();
    const bounds = home.getBoundingClientRect();
    return {
      width: bounds.width,
      expectedWidth: window.innerWidth <= 820 ? shell.width : Math.min(shell.width - 48, 1440),
      centered: Math.abs(bounds.x + bounds.width / 2 - shell.x - shell.width / 2) < 2,
    };
  });
  check(
    Math.abs(layout.width - layout.expectedWidth) < 2 && layout.centered,
    "Trip columns remain spacious with modest centered desktop insets",
    layout,
  );
  const icons = await page.locator(".trip-home-card").evaluateAll((cards) =>
    cards.map((card) => {
      const icon = card.querySelector("svg");
      const label = card.querySelector(".trip-home-card__label");
      return (
        !!icon &&
        icon.getAttribute("aria-hidden") === "true" &&
        icon.getBoundingClientRect().right <= label.getBoundingClientRect().left
      );
    }),
  );
  check(
    icons.length === 5 && icons.every(Boolean),
    "all five actions have a leading decorative icon",
    icons,
  );
  const frame = await page.locator(".trip-home__composer").evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      background: style.backgroundColor,
      border: style.borderTopWidth,
      shadow: style.boxShadow,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
    };
  });
  check(
    frame.background === "rgba(0, 0, 0, 0)" &&
      frame.border === "0px" &&
      frame.shadow === "none" &&
      frame.paddingTop === "0px" &&
      frame.paddingBottom === "0px",
    "the shared composer has no second painted frame or vertical padding band in the browser fixture",
    frame,
  );
  const counts = await page.locator(".trip-home-card").evaluateAll((cards) =>
    cards.flatMap((card) => {
      const label = card.querySelector(".trip-home-card__label");
      const count = card.querySelector(".trip-home-card__count");
      if (!label || !count) return [];
      const title = label.getBoundingClientRect();
      const value = count.getBoundingClientRect();
      const text = document.createRange();
      text.selectNodeContents(label);
      const textBounds = text.getBoundingClientRect();
      return [
        {
          text: count.textContent,
          right: value.left >= title.right,
          gap: value.left - textBounds.right,
          cardRightGap: card.getBoundingClientRect().right - value.right,
          expectedCardRightGap:
            parseFloat(getComputedStyle(card).paddingRight) +
            parseFloat(getComputedStyle(card).borderRightWidth),
          centered: Math.abs(value.y + value.height / 2 - title.y - title.height / 2) < 2,
        },
      ];
    }),
  );
  check(
    counts.length > 0 &&
      counts.every(
        (count) =>
          /^\d+$/.test(count.text) &&
          count.right &&
          count.centered &&
          Math.abs(count.cardRightGap - count.expectedCardRightGap) < 2,
      ),
    "action counts are bare numbers beside their titles",
    counts,
  );
  if (page.viewportSize().width > 1000) {
    const selected = await page
      .locator(".sidebar-nav [aria-current] .sidebar-nav__label")
      .allTextContents();
    check(
      selected.length === 1 && /^(Trips|行程)$/.test(selected[0]),
      "Trip home selects Trips in the sidebar",
      selected,
    );
    await page.locator('.trip-home-card[data-card="itinerary"]').click();
    const panel = page.locator('.trip-home-action-surface[role="dialog"]');
    await panel.waitFor();
    await page.waitForFunction(() => {
      const panel = document.querySelector(".trip-home-action-surface.is-expanded");
      const map = document.querySelector(".trip-home__map");
      if (!panel || !map) return false;
      const rect = panel.getBoundingClientRect();
      return rect.width > 200 && rect.right <= map.getBoundingClientRect().left + 2;
    });
    check(true, "actions stay beside the centered Trip map");
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
  }
}

export async function checkLinkedChatLayout(page, check) {
  const phone = page.viewportSize().width <= 520;
  const chips = page.locator(".workspace-topbar .fact-chips");
  check(
    (await chips.count()) === (phone ? 1 : 0),
    phone
      ? "linked phone Chat retains its Trip details editor host"
      : "linked Chat omits duplicate Trip fact chips",
  );
  const overflow = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  check(
    overflow.width === overflow.scrollWidth,
    "linked Chat has no horizontal page overflow",
    overflow,
  );
}
