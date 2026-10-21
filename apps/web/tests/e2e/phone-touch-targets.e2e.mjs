import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/phone-touch-targets", process.env.EVIDENCE_LABEL ?? "after");
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const box = async (locator) => {
  const rect = await locator.boundingBox();
  return rect && { width: Math.round(rect.width), height: Math.round(rect.height * 10) / 10 };
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [1440, 1000],
  ]) {
    const phone = width <= 520;
    const id = `${width}x${height}`;
    const context = await browser.newContext({
      viewport: { width, height },
      locale: "en-AU",
      hasTouch: phone,
      isMobile: phone,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const prompt = page.locator(".location-prompt");
    if (await prompt.isVisible().catch(() => false)) await prompt.locator("button").last().click();

    if (phone) {
      await page.getByRole("tab", { name: /^Trip/ }).click();
      const empty = page.locator(".trip-drawer-empty:visible");
      await empty.waitFor();
      for (const name of ["Plan in Chat", "Add trip details"]) {
        const size = await box(empty.getByRole("button", { name, exact: true }));
        check(size && size.height >= 44, `${id} empty Trip "${name}" is at least 44 px high`, size);
      }
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/${id}-trip-empty.png` });
      await page.getByRole("tab", { name: /^Chat/ }).click();
    }

    await page.locator(".chat-empty__suggestions button").first().click();
    const think = page.locator(".thinking-turn > .thinking-row__line").last();
    await think.waitFor({ timeout: 90_000 });
    await page.locator(".thinking-turn[data-state='ok']").last().waitFor({ timeout: 90_000 });
    await page.waitForTimeout(800);
    const size = await box(think);
    if (phone) check(size && size.height >= 44, `${id} Think toggle is at least 44 px high`, size);
    else check(size && size.height < 44, `${id} desktop Think row keeps its compact height`, size);
    await page.screenshot({ path: `${out}/${id}-think.png` });
    const before = await think.getAttribute("aria-expanded");
    await think.click();
    const after = await think.getAttribute("aria-expanded");
    check(before !== after, `${id} Think toggle still toggles`, { before, after });
    check(errors.length === 0, `${id} no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completed", String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(checks, null, 2));
}
if (checks.some(({ ok }) => !ok)) process.exit(1);
