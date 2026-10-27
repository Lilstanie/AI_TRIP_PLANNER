export async function setPhoneLanguage(page, language) {
  await page.locator(".phone-mine__settings").click();
  const settings = page.getByRole("dialog", { name: /^(Settings|设置)$/, exact: true });
  await settings.waitFor();
  await page.locator("#settings-tab-region").click();
  await settings.getByRole("button", { name: /^(Change Language|更改 语言)$/ }).click();
  await settings
    .getByRole("group", { name: /^(Language|语言)$/ })
    .getByRole("button", { name: language === "zh" ? "简体中文" : "English", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await settings.waitFor({ state: "hidden" });
}
