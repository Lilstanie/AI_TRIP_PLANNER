import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/planning-wait-status",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const BASE = new URL(process.env.BASE_URL ?? "http://localhost:3000");
const STEP_MS = 700;

const relay = http.createServer((request, response) => {
  const upstream = http.request(
    {
      host: BASE.hostname,
      port: BASE.port,
      path: request.url,
      method: request.method,
      headers: request.headers,
    },
    (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      if (!request.url?.startsWith("/api/chat")) return answer.pipe(response);
      const queue = [];
      let ended = false;
      let pumping = false;
      const pump = () => {
        if (pumping) return;
        pumping = true;
        const next = () => {
          if (queue.length) {
            response.write(queue.shift());
            setTimeout(next, STEP_MS);
          } else if (ended) response.end();
          else pumping = false;
        };
        next();
      };
      let partial = "";
      answer.on("data", (chunk) => {
        const lines = (partial + chunk).split("\n");
        partial = lines.pop() ?? "";
        for (const line of lines) queue.push(`${line}\n`);
        pump();
      });
      answer.on("end", () => {
        if (partial) queue.push(partial);
        ended = true;
        pump();
      });
    },
  );
  request.pipe(upstream);
});
await new Promise((done) => relay.listen(0, "127.0.0.1", done));
const relayUrl = `http://127.0.0.1:${relay.address().port}`;
const browser = await chromium.launch({ channel: process.env.CHANNEL });

const watchStatus = async (page, label) => {
  const statuses = [];
  const running = [];
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const turn = page.locator('.thinking-turn[data-state="running"]').first();
    if (await turn.count()) {
      const text = (await turn.locator(".thinking-row__summary-text").first().innerText()).trim();
      if (text && statuses.at(-1) !== text) statuses.push(text);
      const line = page.locator(".thinking-running__label").first();
      if (await line.count()) running.push((await line.innerText()).trim());
      if (statuses.length === 3)
        await page.screenshot({ path: resolve(out, `${label}-waiting.png`) });
    } else if (statuses.length && (await page.locator(".msg-item").count()) >= 2) break;
    await page.waitForTimeout(150);
  }
  return { statuses, running: [...new Set(running)] };
};

try {
  for (const { locale, label, preparing, assembling, deepDiving } of [
    {
      locale: "en-AU",
      label: "en",
      preparing: "Preparing your request.",
      assembling: /Assembling the plan/,
      deepDiving: "Deep diving",
    },
    {
      locale: "zh-CN",
      label: "zh",
      preparing: "正在理解你的需求。",
      assembling: /正在整理方案/,
      deepDiving: "深入研究中",
    },
  ]) {
    const context = await browser.newContext({ locale, viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto(relayUrl, { waitUntil: "networkidle" });
    await page.locator(".chat-suggestions__chip").first().click();
    const { statuses, running } = await watchStatus(page, label);
    await page.screenshot({ path: resolve(out, `${label}-done.png`) });
    writeFileSync(resolve(out, `${label}-statuses.json`), JSON.stringify(statuses, null, 2));

    const firstOther = statuses.findIndex((text) => text !== preparing);
    check(
      statuses.length >= 4,
      `${label}: the waiting status changes as work progresses`,
      statuses,
    );
    check(
      firstOther >= 0 && !statuses.slice(firstOther).includes(preparing),
      `${label}: the status never falls back to "${preparing}"`,
    );
    check(
      statuses.some((text) => assembling.test(text)),
      `${label}: the final step names the coordinator's assembly`,
      statuses.at(-1),
    );
    check(
      running.length === 1 && running[0] === deepDiving,
      `${label}: the running line reads "${deepDiving}"`,
      running,
    );
    check(pageErrors.length === 0, `${label}: no page errors`, pageErrors);
    await context.close();
  }
} finally {
  await browser.close();
  relay.close();
  writeFileSync(resolve(out, "summary.json"), JSON.stringify({ base: BASE.href, checks }, null, 2));
}
const failed = checks.filter((item) => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed; evidence in ${out}`);
if (failed.length) process.exit(1);
