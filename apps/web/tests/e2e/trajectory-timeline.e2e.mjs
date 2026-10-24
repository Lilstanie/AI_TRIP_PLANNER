import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/trajectory-timeline");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const COPY = {
  en: {
    locale: "en-AU",
    conversation: "Conversation",
    trajectory: "Trajectory",
    timeline: "Trajectory timeline",
    search: "Search trajectory",
    next: "Next result",
    prev: "Previous result",
    stay: "Stay",
    dining: "Food & dining",
    lanes: { user: "USER", message: "ASSISTANT", tool: "TOOL", subtool: "SUBTOOL" },
  },
  zh: {
    locale: "zh-CN",
    conversation: "对话",
    trajectory: "轨迹",
    timeline: "轨迹时间线",
    search: "搜索轨迹",
    next: "下一个结果",
    prev: "上一个结果",
    stay: "住宿",
    dining: "餐饮",
    lanes: { user: "用户", message: "助手", tool: "工具", subtool: "子工具" },
  },
};
const PLAN = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";
const DURATION =
  /\b\d+(?:[.,]\d+)?\s?(?:ms|msec|sec|secs|seconds?|mins?|minutes?|h)\b|\d{1,2}:\d{2}|elapsed|tokens?|用时|耗时|已用/i;

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const box = (page) => page.locator(".chat__form textarea");
const replies = (page) => page.locator(".msg-item--agent");

async function send(page, text) {
  const before = await replies(page).count();
  await box(page).fill(text);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length > count,
    [".msg-item--agent", before],
    { timeout: 240_000 },
  );
  await page.waitForTimeout(800);
}

const ledgerRows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-trajectory-scroll] tr[data-record-index]")].map((row) => ({
      index: Number(row.getAttribute("data-record-index")),
      kind: row.getAttribute("data-kind"),
      hit: row.getAttribute("data-search-hit") === "true",
      active: row.getAttribute("data-search-active") === "true",
      selected: row.getAttribute("data-selected") === "true",
      running: row.getAttribute("data-running") === "true",
      text: row.cells[1]?.innerText.replace(/\s+/g, " ").trim() ?? "",
    })),
  );

const pane = (page) =>
  page.evaluate(() => {
    const node = document.querySelector("[data-trajectory-scroll]");
    return {
      top: node.scrollTop,
      gap: node.scrollHeight - node.clientHeight - node.scrollTop,
      scrollable: node.scrollHeight > node.clientHeight + 4,
    };
  });

const rowInView = (page, index) =>
  page.evaluate((target) => {
    const node = document.querySelector("[data-trajectory-scroll]");
    const row = node?.querySelector(`tr[data-record-index="${target}"]`);
    if (!node || !row) return false;
    const box = node.getBoundingClientRect();
    const at = row.getBoundingClientRect();
    return at.top >= box.top - 1 && at.bottom <= box.bottom + 1;
  }, index);

const lastIndex = (page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-trajectory-scroll] tr[data-record-index]")];
    return Number(rows.at(-1)?.getAttribute("data-record-index") ?? -1);
  });

const spans = (page, copy) =>
  page
    .getByRole("region", { name: copy.timeline })
    .locator("[data-timeline-span]")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        kind: node.getAttribute("data-timeline-span"),
        index: Number(node.getAttribute("data-timeline-record-index")),
        match: node.getAttribute("data-search-match"),
      })),
    );

const GATE = `
(() => {
  const real = window.fetch.bind(window);
  const gate = { on: false, lines: 0, released: 0, waiters: [] };
  window.__gate = gate;
  const wake = () => gate.waiters.splice(0).forEach((resolve) => resolve());
  gate.release = (count) => { gate.released += count; wake(); };
  gate.releaseAll = () => { gate.released = Infinity; wake(); };
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (!gate.on || !url.includes("/api/chat")) return real(input, init);
    const response = await real(input, init);
    const lines = (await response.text()).split("\\n").filter((line) => line.trim());
    gate.lines = lines.length;
    gate.released = 0;
    const encoder = new TextEncoder();
    let at = 0;
    const stream = new ReadableStream({
      async pull(controller) {
        while (at < lines.length && at >= gate.released) {
          await new Promise((resolve) => gate.waiters.push(resolve));
        }
        if (at >= lines.length) return controller.close();
        controller.enqueue(encoder.encode(lines[at] + "\\n"));
        at += 1;
      },
    });
    return new Response(stream, { status: response.status, headers: response.headers });
  };
})();
`;

try {
  for (const locale of ["en", "zh"]) {
    const copy = COPY[locale];
    const label = `${locale}-1440`;
    const context = await browser.newContext({
      locale: copy.locale,
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(GATE);
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
    const conversationTab = page.getByRole("tab", { name: copy.conversation, exact: true });
    const trajectoryTab = page.getByRole("tab", { name: copy.trajectory, exact: true });
    await conversationTab.waitFor({ timeout: 15_000 });

    await send(page, PLAN);
    await send(page, `@${copy.stay} find a stay near Shinjuku`);
    await send(page, `@${copy.dining} I land on flight QF25 at night`);
    await trajectoryTab.click();
    await page.locator("[data-trajectory-scroll]").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);

    const rows = await ledgerRows(page);
    const timeline = page.getByRole("region", { name: copy.timeline });
    const blocks = await spans(page, copy);
    const lanes = await timeline.evaluate((node) => [
      ...new Set(
        [...node.querySelectorAll("[data-timeline-span]")].map((span) =>
          span.getAttribute("data-timeline-span"),
        ),
      ),
    ]);
    const kinds = [...new Set(rows.map((row) => row.kind))];
    check(
      kinds.every((kind) => lanes.includes(kind)) && lanes.every((lane) => kinds.includes(lane)),
      `${label}: the overview has one lane per record type in the ledger`,
      { lanes, kinds },
    );
    check(blocks.length === rows.length, `${label}: one block per record`, [
      blocks.length,
      rows.length,
    ]);
    check(
      blocks.every((block, at) => at === 0 || block.index > blocks[at - 1].index),
      `${label}: blocks follow event order`,
    );
    const FIRST = 2;
    const LAST = 5;
    const dragged = await page.evaluate(
      ([from, to, count]) => {
        const track = document.querySelector("[data-timeline-domain]")?.closest('[tabindex="0"]');
        if (!track) return null;
        track.setPointerCapture = () => undefined;
        track.style.position = "fixed";
        track.style.left = "0px";
        track.style.width = "1024px";
        const rect = track.getBoundingClientRect();
        const exact = (boundary) => {
          const centre = boundary / count;
          const ulp = 2 ** (Math.floor(Math.log2(centre)) - 52);
          for (let step = 0; step <= 256; step += 1) {
            const fraction = centre + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * ulp;
            const x = rect.left + fraction * rect.width;
            if (((x - rect.left) / rect.width) * count === boundary) return x;
          }
          return null;
        };
        const x1 = exact(from);
        const x2 = exact(to);
        if (x1 === null || x2 === null) return { x1, x2 };
        const y = rect.top + rect.height / 2;
        const fire = (type, x, buttons) =>
          track.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 7,
              pointerType: "mouse",
              button: 0,
              buttons,
              clientX: x,
              clientY: y,
            }),
          );
        fire("pointerdown", x1, 1);
        fire("pointermove", (x1 + x2) / 2, 1);
        fire("pointermove", x2, 1);
        fire("pointerup", x2, 0);
        return { x1, x2 };
      },
      [FIRST, LAST, blocks.length],
    );
    check(
      dragged?.x1 != null && dragged?.x2 != null,
      `${label}: two record boundaries can be dragged between exactly`,
      dragged,
    );
    if (dragged?.x1 != null && dragged?.x2 != null) {
      await page.waitForTimeout(300);
      const marked = await timeline
        .locator('[data-selected="true"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => Number(node.getAttribute("data-timeline-record-index"))),
        );
      const expected = blocks.slice(FIRST, LAST).map((block) => block.index);
      check(
        JSON.stringify(marked) === JSON.stringify(expected),
        `${label}: a range between two boundaries marks only the records inside it`,
        { marked, expected },
      );
      await timeline.locator('[tabindex="0"]').press("Escape");
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const track = document.querySelector("[data-timeline-domain]")?.closest('[tabindex="0"]');
        for (const property of ["position", "left", "width"]) track?.style.removeProperty(property);
      });
    }
    const timelineText = await timeline.evaluate((node) => {
      const own = node.innerText;
      const titles = [...node.querySelectorAll("[title],[aria-label]")].map(
        (el) => `${el.getAttribute("title") ?? ""} ${el.getAttribute("aria-label") ?? ""}`,
      );
      return `${own}\n${titles.join("\n")}`;
    });
    const ledgerText = await page.locator("[data-trajectory-scroll]").innerText();
    check(
      !DURATION.test(timelineText),
      `${label}: the overview shows no duration`,
      timelineText.match(DURATION)?.[0],
    );
    check(
      !DURATION.test(ledgerText),
      `${label}: the ledger shows no duration`,
      ledgerText.match(DURATION)?.[0],
    );
    await page.screenshot({ path: `${out}/${label}-overview.png` });

    const state = await pane(page);
    check(state.scrollable, `${label}: the ledger is taller than its pane`, state);
    const first = blocks.find((block) => block.kind === "tool");
    await page.locator("[data-trajectory-scroll]").evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await page.waitForTimeout(300);
    const farBefore = (await pane(page)).top;
    await timeline.locator(`[data-timeline-record-index="${first.index}"]`).click({ force: true });
    await page.waitForTimeout(1200);
    const selected = (await ledgerRows(page)).filter((row) => row.selected);
    check(
      selected.length === 1 && selected[0].index === first.index,
      `${label}: clicking a block selects its record`,
      selected.map((row) => row.index),
    );
    check(
      await rowInView(page, first.index),
      `${label}: clicking a block scrolls its record into view`,
    );
    check(
      (await pane(page)).top < farBefore,
      `${label}: the ledger left the tail for an earlier turn`,
      [farBefore, (await pane(page)).top],
    );
    await page
      .getByRole("button", { name: /^(Close details|关闭详情)$/ })
      .click()
      .catch(() => undefined);

    const searchBox = page.getByRole("searchbox", { name: copy.search });
    const counter = page.locator("[data-search-count]");
    check((await counter.count()) === 0, `${label}: no hit counter before searching`);

    const queries = [
      { name: "specialist name", term: copy.stay },
      { name: "place", term: "Shinjuku" },
      { name: "flight number", term: "QF25" },
    ];
    for (const query of queries) {
      await searchBox.fill(query.term);
      await page.waitForTimeout(500);
      const found = await ledgerRows(page);
      const count = Number(await counter.getAttribute("data-search-count"));
      const marked = found.filter((row) => row.hit);
      const overview = (await spans(page, copy)).filter((block) => block.match === "true");
      check(count > 0 && marked.length === count, `${label}: ${query.name} marks every hit`, [
        count,
        marked.length,
      ]);
      check(
        overview.length === count &&
          overview.every((block) => marked.some((row) => row.index === block.index)),
        `${label}: the overview marks the same records as the ledger (${query.name})`,
        [overview.length, count],
      );
      check(
        found.filter((row) => row.active).length === 1,
        `${label}: exactly one hit is current (${query.name})`,
      );
    }
    await searchBox.fill("QF25");
    await page.waitForTimeout(500);
    const flight = await ledgerRows(page);
    check(
      flight.some((row) => row.kind === "user" && row.text.includes("QF25") && row.hit),
      `${label}: the flight number marks the traveller message that carries it`,
    );

    await searchBox.fill(copy.stay);
    await page.waitForTimeout(500);
    const hitRows = (await ledgerRows(page)).map((row) => row.index);
    const total = hitRows.length;
    check(total >= 3, `${label}: the specialist name has several hits to step through`, total);
    const order = [];
    const readCurrent = async () => (await ledgerRows(page)).find((row) => row.active)?.index;
    order.push(await readCurrent());
    const nextButton = page.getByRole("button", { name: copy.next });
    const prevButton = page.getByRole("button", { name: copy.prev });
    for (let step = 1; step < total; step += 1) {
      await nextButton.click();
      await page.waitForTimeout(450);
      order.push(await readCurrent());
    }
    check(
      JSON.stringify(order) === JSON.stringify(hitRows),
      `${label}: next steps through the hits in event order`,
      { order, hitRows },
    );
    check(await rowInView(page, order.at(-1)), `${label}: the current hit is in view`);
    await nextButton.click();
    await page.waitForTimeout(450);
    check((await readCurrent()) === hitRows[0], `${label}: next wraps to the first hit`);
    await prevButton.click();
    await page.waitForTimeout(450);
    check((await readCurrent()) === hitRows.at(-1), `${label}: previous wraps to the last hit`);
    await searchBox.press("Enter");
    await page.waitForTimeout(450);
    check((await readCurrent()) === hitRows[0], `${label}: Enter steps to the next hit`);
    await searchBox.press("Shift+Enter");
    await page.waitForTimeout(450);
    check((await readCurrent()) === hitRows.at(-1), `${label}: Shift+Enter steps back`);
    await page.screenshot({ path: `${out}/${label}-search-hit.png` });

    await searchBox.fill("zzzz-no-such-record");
    await page.waitForTimeout(400);
    check(
      Number(await counter.getAttribute("data-search-count")) === 0 &&
        (await nextButton.isDisabled()) &&
        (await prevButton.isDisabled()),
      `${label}: an unmatched query shows zero hits and disables stepping`,
    );
    await searchBox.fill("");
    await page.waitForTimeout(400);
    const cleared = await ledgerRows(page);
    check(
      cleared.length === rows.length && cleared.every((row) => !row.hit && !row.active),
      `${label}: clearing the search removes the highlight`,
    );

    await conversationTab.click();
    await page.locator(".chat__stream").waitFor();
    await page.evaluate(() => {
      window.__gate.on = true;
    });
    await box(page).fill(`@${copy.stay} find another stay`);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__gate.lines > 0, null, { timeout: 120_000 });
    const lineCount = await page.evaluate(() => window.__gate.lines);
    check(lineCount >= 6, `${label}: the fixture run streams several events`, lineCount);
    await trajectoryTab.click();
    await page.locator("[data-trajectory-scroll]").waitFor({ timeout: 10_000 });
    const startRows = await ledgerRows(page);
    const startTail = await lastIndex(page);
    check(
      (await pane(page)).gap <= 4 && (await rowInView(page, startTail)),
      `${label}: opening the Trajectory mid-stream starts at the tail`,
      await pane(page),
    );

    let followed = true;
    let followDetail = [];
    let sawRunning = false;
    const third = Math.max(1, Math.floor(lineCount / 3));
    for (let released = 0; released < third * 2; released += 1) {
      await page.evaluate(() => window.__gate.release(1));
      await page.waitForTimeout(350);
      const tail = await lastIndex(page);
      const ok = (await pane(page)).gap <= 4 && (await rowInView(page, tail));
      followDetail.push([tail, ok]);
      if ((await ledgerRows(page)).some((row) => row.running)) sawRunning = true;
      if (!ok) followed = false;
    }
    const grown = (await ledgerRows(page)).length;
    check(grown > startRows.length, `${label}: records arrive while the reply streams`, [
      startRows.length,
      grown,
    ]);
    check(
      followed,
      `${label}: the ledger keeps the newest record in view while records arrive`,
      followDetail,
    );
    check(sawRunning, `${label}: an assignment is shown as running while it works`);
    await page.screenshot({ path: `${out}/${label}-mid-stream.png` });

    await page.locator("[data-trajectory-scroll]").evaluate((node) => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event("scroll"));
    });
    await page.waitForTimeout(300);
    const heldRows = (await ledgerRows(page)).length;
    await page.evaluate(
      (count) => window.__gate.release(count),
      Math.max(1, Math.floor(lineCount / 6)),
    );
    await page.waitForTimeout(900);
    const held = await pane(page);
    const heldGrown = (await ledgerRows(page)).length;
    check(heldGrown > heldRows, `${label}: records keep arriving after scrolling up`, [
      heldRows,
      heldGrown,
    ]);
    check(held.top <= 4, `${label}: after scrolling up the ledger stays put`, held);
    await page.screenshot({ path: `${out}/${label}-scrolled-up.png` });

    await page.locator("[data-trajectory-scroll]").evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__gate.releaseAll());
    await page.waitForFunction(
      () => !document.querySelector("[data-trajectory-scroll] tr[data-running='true']"),
      null,
      { timeout: 60_000 },
    );
    await page.waitForTimeout(900);
    const finalTail = await lastIndex(page);
    check(
      (await pane(page)).gap <= 4 && (await rowInView(page, finalTail)),
      `${label}: returning to the tail resumes following to the reply`,
      await pane(page),
    );
    const finalRows = await ledgerRows(page);
    check(
      finalRows.at(-1)?.kind === "message" && finalRows.every((row) => !row.running),
      `${label}: the stream ends with the reply and no running record`,
    );
    await page.evaluate(() => {
      window.__gate.on = false;
    });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    check(!overflow, `${label}: no horizontal overflow`);
    check(errors.length === 0, `${label}: no page errors`, errors);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
