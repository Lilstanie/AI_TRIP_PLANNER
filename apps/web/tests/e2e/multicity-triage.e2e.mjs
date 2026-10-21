import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { openMockWorkspace } from "./trip-setup.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = process.env.MULTICITY_EVIDENCE ?? resolve("output/e2e/multicity-triage");
mkdirSync(out, { recursive: true });
const checks = [];
function check(ok, message) {
  checks.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
}
const message =
  "Plan a 5-day trip to Sydney & Wollongong for 2 people from 2026-12-16 to 2026-12-20, total budget 4500.";
const response = await fetch(`${base}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-trip-data-mode": "mock" },
  body: JSON.stringify({ tripId: "triage-multicity", message }),
});
const text = await response.text();
writeFileSync(`${out}/sydney-wollongong.ndjson`, text);
const frames = text.trim().split("\n").map(JSON.parse);
const terminal = frames.at(-1);
check(
  response.ok && terminal.type === "complete",
  "exact Sydney/Wollongong suggestion completes via public chat API",
);
if (terminal.type !== "complete") throw new Error(JSON.stringify(terminal));
const plan = terminal.response.plan;
const section = (name) => {
  const proposal = plan.sections.find((entry) => entry.id === name)?.proposal;
  return name === "accommodation" ? (proposal?.stays ?? []) : (proposal?.items ?? []);
};
const hops = section("transport").filter((item) => item.location?.includes("Sydney → Wollongong"));
const stays = section("accommodation");
writeFileSync(`${out}/plan.json`, JSON.stringify(plan, null, 2));
check(
  hops.length === 1 && hops[0].day === 3,
  "offline baseline moves to Wollongong on Day 3, after two Sydney nights",
);
for (let day = 1; day <= 5; day++) {
  const city = day < 3 ? "Sydney" : "Wollongong";
  const activities = section("itinerary").filter(
    (item) => item.kind === "activity" && item.day === day,
  );
  check(
    activities.length > 0 && activities.every((item) => item.location.includes(city)),
    `offline Day ${day} activities are in ${city}`,
  );
}
check(
  stays.some((stay) => stay.day === 1 && stay.city === "Sydney" && stay.nights === 2) &&
    stays.some((stay) => stay.day === 3 && stay.city === "Wollongong" && stay.nights === 2),
  "offline stays begin in Sydney on Day 1 and Wollongong on Day 3",
);

const conjunction =
  "Plan a 5-day trip to Sydney and Wollongong for 2 people from 2026-12-16 to 2026-12-20, total budget 4500.";
const natural = await fetch(`${base}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-trip-data-mode": "mock" },
  body: JSON.stringify({ tripId: "triage-multicity-and", message: conjunction }),
});
const naturalText = await natural.text();
writeFileSync(`${out}/sydney-and-wollongong.ndjson`, naturalText);
const clarification = naturalText.trim().split("\n").map(JSON.parse).at(-1);
check(natural.ok && clarification.type === "ask_user", '"and" asks for destination confirmation');
if (clarification.type !== "ask_user") throw new Error(JSON.stringify(clarification));
const confirmed = await fetch(`${base}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-trip-data-mode": "mock" },
  body: JSON.stringify({
    tripId: "triage-multicity-and",
    message: `${clarification.questions[0].header}: ${clarification.questions[0].options[1].label}`,
    known: clarification.known,
  }),
});
const confirmedText = await confirmed.text();
writeFileSync(`${out}/confirmed-cities.ndjson`, confirmedText);
const naturalTerminal = confirmedText.trim().split("\n").map(JSON.parse).at(-1);
check(
  confirmed.ok && naturalTerminal.type === "complete",
  'the same trip written with "and" completes via public chat API',
);
if (naturalTerminal.type === "complete") {
  const naturalPlan = naturalTerminal.response.plan;
  writeFileSync(`${out}/plan-and.json`, JSON.stringify(naturalPlan, null, 2));
  const naturalTransport =
    naturalPlan.sections.find((entry) => entry.id === "transport")?.proposal?.items ?? [];
  check(
    naturalPlan.brief.destination === "Sydney & Wollongong",
    `"Sydney and Wollongong" is kept as two cities (got ${JSON.stringify(naturalPlan.brief.destination)})`,
  );
  check(
    naturalTransport.some((item) => item.location?.includes("Sydney → Wollongong")),
    'the "and" phrasing still plans the Sydney to Wollongong hop',
  );
  check(
    !naturalTransport.some((item) => /flight/i.test(item.detail ?? "")),
    "no flight is planned when the traveller already starts in the first city",
  );
}
const activity = [
  { type: "agent_started", agent: "itinerary", round: 1 },
  { type: "agent_completed", agent: "itinerary", round: 1, summary: "Day plan ready." },
  { type: "coordinator", phase: "revision", round: 2, summary: "Revising affected sections." },
  { type: "agent_started", agent: "accommodation", round: 2 },
  { type: "agent_completed", agent: "accommodation", round: 2, summary: "Stay revised." },
  {
    type: "agent_reasoning",
    agent: "itinerary",
    round: 3,
    episode: 3,
    index: 0,
    text: "Review the revised stay.",
  },
];
writeFileSync(`${out}/thinking-replay.json`, JSON.stringify(activity, null, 2));
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/api/chat", async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: [...activity, terminal].map(JSON.stringify).join("\n") + "\n",
      }),
    );
    await openMockWorkspace(page, base);
    await page.locator(".chat-empty__suggestions button").first().click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 30_000 });
    const thinking = page.locator(".msg-item--agent .agent-activity").first();
    await thinking
      .getByRole("button", { name: /^Think/ })
      .first()
      .click();
    const content = await thinking.innerText();
    writeFileSync(`${out}/thinking-${width}.txt`, content);
    check(
      !content.includes("Waiting for update"),
      `${width}px: settled reasoning-only row never waits for an update`,
    );
    check(
      !content.includes("Round 3 · Round 3 of the plan"),
      `${width}px: round heading does not repeat itself`,
    );
    check(content.includes("3 rounds"), `${width}px: summary counts every displayed work round`);
    check(errors.length === 0, `${width}px: no browser errors`);
    await page.screenshot({ path: `${out}/thinking-${width}.png`, fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(
  `${out}/summary.json`,
  JSON.stringify(
    {
      checks,
      limitations:
        "Offline chat baseline and replayed progress events; no live model verification.",
    },
    null,
    2,
  ),
);
process.exitCode = checks.some((item) => !item.ok) ? 1 : 0;
