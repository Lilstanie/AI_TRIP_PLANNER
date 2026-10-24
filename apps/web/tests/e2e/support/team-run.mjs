export async function readRun(page) {
  await page.locator(".team-trigger:visible").first().focus();
  await page.keyboard.press("Enter");
  const panel = page.locator(".team-panel");
  try {
    await panel.waitFor({ timeout: 3000 });
  } catch {
    return null;
  }
  const run = await panel.evaluate((node) => ({
    rows: [...node.querySelectorAll(".team-panel__row")].map((row) => ({
      id: row.getAttribute("data-assistant"),
      name: row.querySelector(".team-panel__name")?.textContent ?? "",
      status: row.getAttribute("data-status"),
      marker: row.querySelector(".team-panel__marker")?.textContent ?? "",
    })),
    assignments: [...node.querySelectorAll(".team-panel__assignment")].map((item) => ({
      who: item.getAttribute("data-assistant"),
      name: item.querySelector(".team-panel__owner")?.textContent ?? "",
      kind: item.getAttribute("data-kind"),
      marker: item.querySelector(".team-panel__marker")?.textContent ?? "",
      source: item.querySelector(".team-panel__source")?.textContent ?? "",
      text: item.querySelector(".team-panel__text")?.textContent ?? "",
      icon: item.querySelectorAll(".assistant-icon svg").length,
    })),
    checks: [...node.querySelectorAll(".team-panel__check")].map((item) => ({
      type: item.getAttribute("data-check"),
      text: item.textContent ?? "",
      icons: item.querySelectorAll(".assistant-icon").length,
    })),
  }));
  await page.keyboard.press("Escape");
  await panel.waitFor({ state: "detached" });
  return run;
}
