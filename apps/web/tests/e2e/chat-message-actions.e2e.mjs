import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(process.env.CHAT_ACTIONS_OUT ?? "output/playwright/chat-message-actions");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.setDefaultTimeout(120000);
const checks = [];
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
const check = (ok, name, details) => {
  checks.push({ ok, name, details });
  console.log(`${ok ? "ok" : "FAIL"} ${name} ${JSON.stringify(details ?? "")}`);
};
try {
  await page.goto(process.env.BASE_URL ?? "http://localhost:3000", {
    timeout: 180000,
    waitUntil: "domcontentloaded",
  });
  await page.locator(".workspace-app").waitFor();
  await page.locator(".composer__input").waitFor();
  const shell = page.locator(".workspace-shell");
  const mapWidth = () =>
    page.locator(".workspace-panel--map").evaluate((el) => el.getBoundingClientRect().width);
  check((await shell.getAttribute("data-map")) === "hidden", "new chat starts without the map");
  check((await mapWidth()) < 2, "map panel takes no width in a new chat", {
    width: await mapWidth(),
  });
  const tab = page.getByRole("tab", { name: "Conversation" });
  const tabStyle = await tab.evaluate((el) => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, radius: style.borderTopLeftRadius };
  });
  check(
    tabStyle.background === "rgba(0, 0, 0, 0)" && tabStyle.radius === "0px",
    "tabs are plain text, not pills",
    tabStyle,
  );
  await page.screenshot({ path: `${out}/1-new-chat.png` });

  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent").first().waitFor();
  await page.waitForFunction(
    () => document.querySelector(".workspace-panel--map").getBoundingClientRect().width > 300,
  );
  await page.waitForTimeout(800);
  check((await shell.getAttribute("data-map")) === "shown", "map appears once a plan exists");
  await page.screenshot({ path: `${out}/2-planned.png` });

  const toggle = page.locator(".thinking-row__toggle").first();
  const toggleStyle = await toggle.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      border: style.borderTopWidth,
      background: style.backgroundColor,
      height: el.getBoundingClientRect().height,
    };
  });
  check(
    toggleStyle.border === "0px" &&
      toggleStyle.background === "rgba(0, 0, 0, 0)" &&
      toggleStyle.height <= 24,
    "Think toggle is plain text on a 24 px row",
    toggleStyle,
  );

  const userMessage = page.locator(".msg-item--user").first();
  const userText = await userMessage.locator(".msg-item__bubble").innerText();
  const selected = await page.evaluate(() => {
    const body = document.querySelector(".msg-item--agent .msg-item__body");
    const range = document.createRange();
    range.selectNodeContents(body);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return { text: selection.toString(), userSelect: getComputedStyle(body).userSelect };
  });
  check(selected.text.length > 20 && selected.userSelect !== "none", "reply text is selectable", {
    length: selected.text.length,
  });

  await userMessage.hover();
  await userMessage.getByRole("button", { name: "Copy message" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  check(copied === userText, "copy button copies the traveller's message", { copied });
  check(
    (await userMessage.getByRole("button", { name: "Copied" }).count()) === 1,
    "copy button confirms it copied",
  );
  const agent = page.locator(".msg-item--agent").first();
  check(
    (await agent.getByRole("button", { name: "Copy message" }).count()) === 1 &&
      (await agent.getByRole("button", { name: "Edit message" }).count()) === 0,
    "reply has copy but no edit",
  );

  await userMessage.getByRole("button", { name: "Edit message" }).click();
  const field = page.getByRole("textbox", { name: "Edit message" });
  await field.press("Escape");
  check((await field.count()) === 0, "Escape leaves edit mode");
  await userMessage.getByRole("button", { name: "Edit message" }).click();
  await field.fill("   ");
  check(
    await page.getByRole("button", { name: "Resend" }).isDisabled(),
    "empty edit cannot be resent",
  );
  await field.fill("Plan a 3-day trip to Melbourne for 2 people, budget 3000");
  await page.getByRole("button", { name: "Resend" }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector(".composer__input")?.disabled &&
      document.querySelectorAll(".msg-item--agent").length === 1,
  );
  const users = await page.locator(".msg-item--user .msg-item__bubble").allInnerTexts();
  check(
    users.length === 1 && users[0].includes("Melbourne"),
    "resend replaces the message and drops the old reply",
    { users, agents: await page.locator(".msg-item--agent").count() },
  );
  await page.screenshot({ path: `${out}/3-resent.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  check(
    (await page.evaluate(() => document.documentElement.scrollWidth)) === 390,
    "phone shell does not scroll sideways",
  );
  await page.screenshot({ path: `${out}/4-phone.png` });
  check(errors.length === 0, "no page errors", errors);
} catch (error) {
  check(false, "journey completed", { error: String(error) });
} finally {
  writeFileSync(`${out}/chat-message-actions.json`, JSON.stringify({ checks }, null, 2));
  await browser.close();
}
process.exitCode = checks.some((entry) => !entry.ok) ? 1 : 0;
