import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip, installSeededItinerary } from "./trip-setup.mjs";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const key = JSON.parse(
  readFileSync("apps/web/lib/workspace/catalog.ts", "utf8").match(
    /export const CATALOG_KEY = ("[^"]+")/,
  )[1],
);
const out = resolve("output/playwright/workspace-control-overflow", process.env.LABEL ?? "after");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, message, geometry) => {
  results.push({ ok: Boolean(ok), message, geometry });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
const hit = (node) => {
  const r = node.getBoundingClientRect();
  return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
};
const tripDrawerGeometry = async (page) =>
  page.locator(".drawer--right.is-open").evaluate((drawer) => {
    const body = drawer.querySelector(".drawer__body");
    const panel = body?.querySelector(".trip-panel");
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bounds = (node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    };
    return {
      drawer: bounds(drawer),
      body: {
        ...bounds(body),
        scrollLeft: body.scrollLeft,
        scrollWidth: body.scrollWidth,
        clientWidth: body.clientWidth,
      },
      panel: panel ? bounds(panel) : null,
      children: [...(panel?.children ?? [])].map((node) => ({
        tag: node.tagName,
        className: typeof node.className === "string" ? node.className : "",
        ...bounds(node),
      })),
      overflowingDescendants: [...(body?.querySelectorAll("*") ?? [])]
        .map((node) => ({ node, rect: node.getBoundingClientRect() }))
        .filter(
          ({ rect }) =>
            rect.left < body.getBoundingClientRect().left - 1 ||
            rect.right > body.getBoundingClientRect().right + 1,
        )
        .map(({ node, rect }) => ({
          tag: node.tagName,
          className: typeof node.className === "string" ? node.className : "",
          insideDayStrip: Boolean(node.closest(".day-strip")),
          left: rect.left,
          right: rect.right,
          width: rect.width,
          text: node.textContent?.trim().slice(0, 80),
        })),
      focused:
        document.activeElement instanceof HTMLElement
          ? { tag: document.activeElement.tagName, ...bounds(document.activeElement) }
          : null,
      actions: [
        ...(focused?.closest(".item-editor")?.querySelectorAll(".item-editor__actions button") ??
          []),
      ].map((node) => ({
        ...bounds(node),
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
      })),
      focusAncestors: (() => {
        const ancestors = [];
        for (let node = focused; node && node !== body; node = node.parentElement) {
          const style = getComputedStyle(node);
          ancestors.push({
            tag: node.tagName,
            className: typeof node.className === "string" ? node.className : "",
            ...bounds(node),
            minWidth: style.minWidth,
            width: style.width,
            marginLeft: style.marginLeft,
          });
        }
        return ancestors;
      })(),
    };
  });
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
let page;
try {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 1000 },
    locale: "en-AU",
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installSeededItinerary(page, [
    {
      id: "layout-stop",
      kind: "activity",
      day: 1,
      location: "Mock attraction near Sydney 悉尼景点",
      detail: "Mock attraction near Sydney 悉尼景点",
      startTime: "09:00",
      endTime: "11:00",
    },
  ]);
  await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
  await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
  await planSuggestedTrip(page);
  const dismiss = page.getByRole("button", { name: "Not now", exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  for (const language of ["en", "zh"]) {
    const zh = language === "zh";
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator(".phone-tabbar").waitFor({ state: "hidden" });
    if (await page.locator(".trips-page").isVisible())
      await openTripWorkspace(page, page.locator(".trip-card").first());
    const close = page.getByRole("button", { name: "Close your trip", exact: true });
    if (await close.isVisible()) await close.click();
    if (zh) await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
    for (const width of [1024, 1001, 1440, 1000, 521, 520, 390]) {
      await page.setViewportSize({ width, height: width === 1024 ? 768 : 1000 });
      await page.locator(".phone-tabbar").waitFor({ state: width <= 520 ? "visible" : "hidden" });
      await page.waitForFunction(
        () => Boolean(document.querySelector('[role="separator"]')) === innerWidth > 1000,
      );
      const separator = page.getByRole("separator", {
        name: zh ? "调整聊天与地图宽度" : "Resize chat and map",
      });
      for (const split of width > 1000 ? ["End", "Home", "default"] : [null]) {
        const label = `${language}/${width}/${split ?? "phone"}`;
        const close = page.getByRole("button", {
          name: zh ? "关闭行程" : "Close your trip",
          exact: true,
        });
        if (await close.isVisible()) await close.click();
        if (split) {
          await separator.focus();
          if (split === "default") await separator.dblclick();
          else await separator.press(split);
        }
        if (width > 520) {
          const scroller = page.locator(".fact-chips__scroller");
          await scroller.hover();
          await page.mouse.wheel(0, 1000);
          const preferences = page.getByRole("button", {
            name: zh ? "打开旅行偏好" : "Open trip preferences",
            exact: true,
          });
          await preferences.focus();
          await preferences.scrollIntoViewIfNeeded();
          const chips = await scroller.evaluate((node) => ({
            client: node.clientWidth,
            scroll: node.scrollWidth,
            offset: node.scrollLeft,
            overflow: getComputedStyle(node).overflowX,
          }));
          check(
            chips.overflow === "auto" &&
              (chips.scroll <= chips.client + 1 || chips.offset > 0) &&
              (await preferences.evaluate(hit)),
            `${label}: #479 preferences reachable without covered controls`,
            chips,
          );
          await preferences.click();
          check(
            (await preferences.getAttribute("aria-expanded")) === "true",
            `${label}: #479 preferences opens`,
          );
          await page.keyboard.press("Escape");
          check(
            await preferences.evaluate((node) => node === document.activeElement),
            `${label}: #479 Escape restores chip focus`,
          );
          await page
            .getByRole("button", { name: zh ? "打开你的行程" : "Open your trip", exact: true })
            .click();
        } else
          await page
            .locator(".phone-tabbar")
            .getByRole("tab", { name: zh ? /^行程/ : /^Trip/ })
            .click();
        if (width === 1024 && split === "End") {
          await page.waitForFunction(() => {
            const drawer = document.querySelector(".drawer--right.is-open");
            const bounds = drawer?.getBoundingClientRect();
            return bounds && bounds.left >= 0 && bounds.right <= innerWidth;
          });
          check(
            true,
            `${label}: #489 drawer geometry after opening`,
            await tripDrawerGeometry(page),
          );
        }
        const badge = page.locator(".budget-status");
        await badge.click({ trial: true });
        const budget = await badge.evaluate((node) => {
          const r = node.getBoundingClientRect(),
            p = node.parentElement.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            parentLeft: p.left,
            parentRight: p.right,
            text: node.textContent,
          };
        });
        check(
          budget.left >= budget.parentLeft - 1 && budget.right <= budget.parentRight + 1,
          `${label}: #478 budget caution fits parent`,
          budget,
        );
        const row = page
          .locator(".timeline-stop")
          .filter({ hasText: "Mock attraction near Sydney" })
          .first();
        await row.locator(".action-menu__trigger").click();
        await page
          .getByRole("menuitem", { name: zh ? "编辑详情" : "Edit details", exact: true })
          .click();
        const heading = page.locator(".stop-place-card__bare h4");
        await heading.waitFor();
        if (width === 1024 && split === "End")
          check(
            true,
            `${label}: #489 drawer geometry after editor focus`,
            await tripDrawerGeometry(page),
          );
        if (width === 1024 && split === "End") {
          const geometry = await tripDrawerGeometry(page);
          check(
            geometry.body.scrollLeft === 0 &&
              geometry.overflowingDescendants.every((node) => node.insideDayStrip) &&
              geometry.focused.left >= geometry.body.left - 1 &&
              geometry.focused.right <= geometry.body.right + 1 &&
              geometry.actions.every(
                (action) =>
                  action.left >= geometry.body.left - 1 &&
                  action.right <= geometry.body.right + 1 &&
                  action.scrollWidth <= action.clientWidth,
              ),
            `${label}: #489 focused editor remains within the drawer without horizontal panning`,
            geometry,
          );
        }
        await page.locator(".stop-place-card__close").click({ trial: true });
        const editor = await heading.evaluate((node) => {
          const p = node.parentElement,
            r = node.getBoundingClientRect(),
            b = p.getBoundingClientRect(),
            close = p.querySelector("button").getBoundingClientRect(),
            status = p.querySelector("p").getBoundingClientRect(),
            style = getComputedStyle(p);
          return {
            width: r.width,
            parentWidth: b.width,
            expected:
              b.width -
              parseFloat(style.paddingLeft) -
              parseFloat(style.paddingRight) -
              parseFloat(style.columnGap) -
              close.width,
            nameTop: r.top,
            nameRight: r.right,
            closeTop: close.top,
            closeLeft: close.left,
            statusTop: status.top,
            statusRight: status.right,
            parentRight: b.right,
          };
        });
        check(
          editor.width >= editor.expected - 1 &&
            Math.abs(editor.nameTop - editor.closeTop) < 1 &&
            editor.nameRight <= editor.closeLeft + 1 &&
            editor.statusTop > editor.nameTop &&
            editor.statusRight <= editor.parentRight + 1,
          `${label}: #477 name, close and lookup status retain their own space`,
          editor,
        );
        check(
          await page.locator(".stop-place-card__close").evaluate(hit),
          `${label}: #477 close is hit-testable`,
        );
        await page.screenshot({
          path: `${out}/${language}-${width}-${split ?? "phone"}.png`,
          fullPage: true,
        });
        await page.locator(".stop-place-card__close").click();
        if (width <= 520) await page.waitForFunction(() => !history.state?.tripPhoneOverlay);
        check(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${label}: no page overflow`,
        );
      }
    }
    await page.evaluate((key) => {
      const catalog = JSON.parse(localStorage.getItem(key));
      if (!catalog.conversations.some((c) => c.id === "layout-chat-0"))
        catalog.conversations.push(
          ...Array.from({ length: 8 }, (_, i) => ({
            id: `layout-chat-${i}`,
            title: `Layout chat ${i}`,
            renamed: true,
            updatedAt: new Date().toISOString(),
            messages: [],
            input: "",
          })),
        );
      localStorage.setItem(key, JSON.stringify(catalog));
    }, key);
    await page.reload();
    for (const width of [1440, 1024, 520, 390, 375]) {
      await page.setViewportSize({ width, height: 800 });
      await page.reload();
      if (width <= 520)
        await page.getByRole("tab", { name: zh ? "我的" : "Mine", exact: true }).click();
      else
        await page
          .locator(".workspace-sidebar")
          .getByRole("button", { name: zh ? /^聊天/ : /^Chats/ })
          .click();
      const container = width <= 520 ? ".phone-mine" : ".chats-panel.is-open";
      const trigger = page.locator(`${container} .history-item__more`).last();
      await trigger.scrollIntoViewIfNeeded();
      await trigger.evaluate((node) => {
        const panel =
          node.closest(".workspace-panel--mine") ?? node.closest(".chats-panel__content");
        panel.scrollTop +=
          node.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom + 12;
      });
      await trigger.click();
      const menu = page.locator(`${container} .history-item__menu`);
      await menu.waitFor();
      const geometry = await menu.evaluate((node) => {
        const r = node.getBoundingClientRect(),
          p = (
            node.closest(".workspace-panel--mine") ?? node.closest(".chats-panel__content")
          ).getBoundingClientRect();
        return {
          top: r.top,
          bottom: r.bottom,
          panelTop: p.top,
          panelBottom: p.bottom,
          focusInside: node.contains(document.activeElement),
          hit: [...node.querySelectorAll("button")].every((b) => {
            const r = b.getBoundingClientRect();
            return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        };
      });
      check(
        geometry.top >= geometry.panelTop - 1 &&
          geometry.bottom <= geometry.panelBottom + 1 &&
          geometry.hit &&
          geometry.focusInside,
        `${language}/${width}: #486 menu visible, focused and tappable`,
        geometry,
      );
      await page.screenshot({ path: `${out}/${language}-${width}-mine-menu.png`, fullPage: true });
      await page.keyboard.press("Escape");
      check(
        await trigger.evaluate((node) => node === document.activeElement),
        `${language}/${width}: #486 Escape restores focus`,
      );
      await page.waitForFunction(() => !history.state?.tripPhoneOverlay);
    }
  }
  check(errors.length === 0, "no page errors", errors);
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
    writeFileSync(`${out}/failure.html`, await page.content());
  }
  throw error;
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
if (results.some((r) => r.ok === false)) process.exitCode = 1;
