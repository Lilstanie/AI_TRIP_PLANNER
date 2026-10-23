import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/mention-menu", process.env.EVIDENCE_LABEL ?? "after");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const STAY = { en: "Stay", zh: "住宿" };
const OPTIONS = 6;

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

async function open(locale, width) {
  const context = await browser.newContext({
    locale: locale === "zh" ? "zh-CN" : "en-AU",
    viewport: { width, height: width === 390 ? 844 : 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base);
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const live = page.getByRole("button", { name: /^(Live data|实时数据)/ });
    if (!(await live.count())) break;
    await live.click();
  }
  return { context, page, errors };
}

const box = (page) => page.locator(".chat__form textarea");
const menu = (page) => page.getByRole("listbox");
const options = (page) => menu(page).getByRole("option");
const value = (page) => box(page).inputValue();
const selection = (page) => box(page).evaluate((node) => [node.selectionStart, node.selectionEnd]);
const active = (page) =>
  page.evaluate(() => {
    const field = document.querySelector(".chat__form textarea");
    const id = field?.getAttribute("aria-activedescendant");
    return {
      text: id ? (document.getElementById(id)?.textContent?.trim() ?? null) : null,
      focused: document.activeElement === field,
    };
  });
const replies = (page) => page.locator(".msg-item--agent");

try {
  for (const locale of ["en", "zh"]) {
    for (const width of [1440, 390]) {
      const label = `${locale}-${width}`;
      const stay = STAY[locale];
      const { context, page, errors } = await open(locale, width);
      const requests = [];
      await page.route("**/api/chat", async (route) => {
        requests.push(JSON.parse(route.request().postData() ?? "{}"));
        await route.continue();
      });
      const field = box(page);
      const whole = `@${stay} `;
      const midDeleted = whole.slice(0, whole.length - 3) + whole.slice(whole.length - 2);

      check(
        (await page.locator(".assistant-chips, .assistant-chip").count()) === 0, // e2e-selectors: absent
        `${label}: no chip row renders`,
      );
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        `${label}: the page does not scroll sideways`,
      );

      await field.click();
      await field.pressSequentially("@");
      await menu(page)
        .waitFor({ timeout: 3000 })
        .catch(() => undefined);
      check((await options(page).count()) === OPTIONS, `${label}: @ opens six options`);
      const iconCount = await menu(page).locator(".assistant-icon").count();
      check(iconCount === OPTIONS, `${label}: every option has an icon`, iconCount);
      if (width === 390) {
        const heights = await options(page).evaluateAll((nodes) =>
          nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
        );
        check(
          heights.every((height) => height >= 44),
          `${label}: every option is 44 px high`,
          heights,
        );
      }
      const first = await active(page);
      check(
        first.focused && Boolean(first.text),
        `${label}: textarea keeps focus and names the active option`,
        first,
      );
      await page.screenshot({ path: `${out}/${label}-menu.png` });

      await page.keyboard.press("ArrowDown");
      const second = await active(page);
      check(
        second.text && second.text !== first.text,
        `${label}: ArrowDown moves the active option`,
        second,
      );
      await page.keyboard.press("ArrowUp");
      check((await active(page)).text === first.text, `${label}: ArrowUp moves it back`);
      check((await value(page)) === "@", `${label}: arrows leave the draft unchanged`);

      await page.keyboard.press("Escape");
      check((await menu(page).count()) === 0, `${label}: Esc closes the menu`);
      check((await value(page)) === "@", `${label}: Esc keeps the draft`);
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowRight");
      check((await menu(page).count()) === 1, `${label}: moving the caret off and back reopens it`);
      await page.keyboard.press("Escape");
      await page.keyboard.type(stay.slice(0, 1));
      check((await menu(page).count()) === 1, `${label}: a changed query reopens a closed menu`);
      await page.keyboard.type(stay.slice(1));
      check((await options(page).count()) === 1, `${label}: @${stay} filters to one option`);

      await page.keyboard.press("Tab");
      check(
        (await value(page)) === `@${stay} `,
        `${label}: Tab inserts the name`,
        await value(page),
      );
      check((await menu(page).count()) === 0, `${label}: picking closes the menu`);
      check(requests.length === 0, `${label}: picking sends nothing`);

      await field.fill("");
      await field.pressSequentially(`hi @${stay[0]}`);
      await page.keyboard.press("Enter");
      check(
        (await value(page)) === `hi @${stay} `,
        `${label}: Enter picks and does not send`,
        await value(page),
      );
      check(requests.length === 0, `${label}: Enter with the menu open sends nothing`);

      await field.fill("");
      await field.pressSequentially("a@b");
      check((await menu(page).count()) === 0, `${label}: @ inside a word opens no menu`);

      await field.fill("");
      await field.pressSequentially("Hello @");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      const hello = await value(page);
      check(
        hello.startsWith("Hello @") && hello.endsWith(" ") && hello.length > 9,
        `${label}: a pick after text keeps the text`,
        hello,
      );
      const token = hello.trimEnd().slice("Hello ".length);

      await page.keyboard.press("Backspace");
      check((await value(page)) === hello, `${label}: first Backspace keeps the text`);
      check(
        JSON.stringify(await selection(page)) === JSON.stringify([6, 6 + token.length]),
        `${label}: first Backspace selects exactly the token`,
        await selection(page),
      );
      await page.screenshot({ path: `${out}/${label}-selected.png` });
      await page.keyboard.press("Backspace");
      check(
        (await value(page)) === "Hello  ",
        `${label}: second Backspace removes only the token`,
        await value(page),
      );

      await field.fill("");
      await field.pressSequentially(`@${stay} `);
      await page.keyboard.press("Backspace");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Backspace");
      check(
        (await value(page)) === midDeleted,
        `${label}: a key between the Backspaces clears the selection`,
        await value(page),
      );

      await field.fill("");
      await field.pressSequentially("plain text");
      await page.keyboard.press("Backspace");
      check(
        (await value(page)) === "plain tex",
        `${label}: Backspace after plain text deletes one letter`,
      );

      await field.fill("");
      await field.pressSequentially(`@${stay} `);
      await page.keyboard.press("Backspace");
      await field.click();
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Backspace");
      check(
        (await value(page)) === midDeleted,
        `${label}: a click clears the selection`,
        await value(page),
      );

      const client = await context.newCDPSession(page);
      await field.fill("");
      await field.focus();
      await client.send("Input.imeSetComposition", {
        text: "@",
        selectionStart: 1,
        selectionEnd: 1,
      });
      check((await menu(page).count()) === 0, `${label}: no menu while composing`);
      await client.send("Input.insertText", { text: "@" });
      await menu(page)
        .waitFor({ timeout: 3000 })
        .catch(() => undefined);
      check((await menu(page).count()) === 1, `${label}: the menu opens once composition commits`);
      await page.keyboard.press("Escape");
      await field.fill(`@${stay} `);
      await field.evaluate((node) => {
        node.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
        node.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, isComposing: true }),
        );
      });
      const composing = await selection(page);
      check(
        composing[0] === composing[1],
        `${label}: Backspace while composing selects nothing`,
        composing,
      );
      await field.evaluate((node) =>
        node.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })),
      );

      await field.fill("");
      await field.pressSequentially(`@${stay}`);
      await page.keyboard.press("Tab");
      await field.pressSequentially("when are Tokyo hotels cheapest?");
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        (selector) => document.querySelectorAll(selector).length > 0,
        ".msg-item--agent",
        { timeout: 240_000 },
      );
      check(
        JSON.stringify(requests.at(-1)?.mentions) === '["accommodation"]',
        `${label}: the request carries the specialist id`,
        requests.at(-1)?.mentions,
      );
      check((await replies(page).count()) > 0, `${label}: the mentioned message is answered`);
      await page.screenshot({ path: `${out}/${label}-sent.png` });

      check(errors.length === 0, `${label}: no page errors`, errors);
      await context.close();
    }
  }
} catch (error) {
  check(false, "journey completed", String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
