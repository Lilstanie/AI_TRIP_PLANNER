// End-to-end check that the conversation, not only the preferences editor, shapes the trip: the
// traveller says in chat that they arrange flights themselves, that their hotel is booked and what
// they do not need, and the plan and every later reply respect it. Replays the Shanghai chat from
// docs feedback through /api/chat the way the workspace sends it (first turn with `known`, later
// turns with the current brief and plan). Every NDJSON stream, the final plans and summary.json
// land under output/e2e/conversation-scope/<run>/ as a repeatable, reviewable artifact.
//
// requires-env: DEEPSEEK_API_KEY
//
//   pnpm --filter @trip/web dev            # in another terminal
//   [DATA_MODE=live|mock] [BASE_URL=...] node apps/web/tests/e2e/conversation-scope.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MODE = process.env.DATA_MODE ?? "live";
const RUN = `${new Date().toISOString().replace(/[:.]/g, "-")}-${MODE}`;
const OUT = resolve(process.cwd(), "output/e2e/conversation-scope", RUN);
mkdirSync(OUT, { recursive: true });

const tripId = `e2e-scope-${Date.now()}`;
let turn = 0;

async function send(request) {
  turn += 1;
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": MODE },
    body: JSON.stringify(request),
  });
  const text = await res.text();
  writeFileSync(`${OUT}/turn-${turn}.ndjson`, text);
  const frames = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const final = frames.findLast((frame) =>
    ["complete", "error", "needs_info", "ask_user", "flight_answer"].includes(frame.type),
  );
  if (final?.type === "complete")
    writeFileSync(`${OUT}/turn-${turn}.plan.json`, JSON.stringify(final.response.plan, null, 2));
  return { status: res.status, final, frames };
}

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
};
/** A sentence that asks about, or prices, flights. */
const flightQuestion = (text) =>
  (text ?? "")
    .split(/(?<=[.?!。？！])\s*/)
    .filter((sentence) => /flight|fly|airfare|机票|航班/i.test(sentence))
    .filter((sentence) =>
      /\?|？|would you like|do you want|shall I|should I|fare|AUD|\$/i.test(sentence),
    );

// Turn 1: a blank conversation that states the whole trip.
const first = await send({
  tripId,
  message:
    "Plan a 3-day trip to Shanghai for 2 people from Sydney, 2026-11-05 to 2026-11-07, budget 3000 AUD.",
  known: {},
});
check(
  first.final?.type === "complete",
  `turn 1 produces a plan (${first.final?.type ?? first.status})`,
);
let plan = first.final?.response?.plan;

// Turn 2: the three things from the Shanghai screenshots, in one message.
const second = await send({
  tripId,
  message:
    "We'll sort out flights ourselves, so leave flights out. Our hotel is already booked: Hilton Shanghai Hongqiao. We have no dietary requirements, and we prefer a relaxed pace.",
  brief: plan?.brief,
  plan,
});
check(second.final?.type === "complete", `turn 2 replans (${second.final?.type ?? second.status})`);
plan = second.final?.response?.plan ?? plan;
const brief = plan?.brief ?? {};
check(brief.excludeFlights === true, `brief records excludeFlights (${brief.excludeFlights})`);
check(
  /hilton/i.test(brief.bookedStay?.name ?? ""),
  `brief records the booked stay (${brief.bookedStay?.name})`,
);
check(
  (brief.learnedPreferences ?? []).length > 0,
  `brief learned preferences from chat (${JSON.stringify(brief.learnedPreferences)})`,
);
check(
  !(brief.preferences ?? []).some((p) => (brief.learnedPreferences ?? []).includes(p)),
  "learned preferences are kept apart from the traveller's own list",
);
const section = (id) => plan?.sections?.find((s) => s.id === id)?.proposal;
const transport = section("transport");
const flights = (transport?.items ?? []).filter((item) => /flight|airline|air /i.test(item.detail));
check(
  flights.every((item) => item.estCost === undefined),
  `no flight is priced (${flights.map((i) => `${i.detail} ${i.estCost ?? ""}`).join(" | ") || "none"})`,
);
check(
  !transport?.flights?.length,
  `no flight candidates offered (${transport?.flights?.length ?? 0})`,
);
check(
  !(plan?.conflicts ?? []).some((c) => /flight|fare/i.test(c.reason)),
  `no flight-fare conflict (${(plan?.conflicts ?? []).map((c) => c.reason).join(" | ") || "none"})`,
);
const stay = section("accommodation");
check(
  (stay?.items ?? []).length === 1 &&
    /hilton/i.test(stay.items[0].detail) &&
    stay.items[0].estCost === undefined,
  `the booked stay is used as given and not priced (${stay?.items?.map((i) => i.detail).join(" | ")})`,
);
check(!stay?.stays?.length, `no other stays are compared (${stay?.stays?.length ?? 0})`);
check(
  !flightQuestion(second.final?.response?.reply).length,
  `turn 2 reply does not ask about or price flights (${JSON.stringify(flightQuestion(second.final?.response?.reply))})`,
);

// Turn 3: an ordinary follow-up must not bring flights or other hotels back.
const third = await send({
  tripId,
  message: "Anything else we should sort out before the trip?",
  brief: plan?.brief,
  plan,
});
const reply3 = third.final?.response?.reply ?? third.final?.question ?? "";
check(Boolean(reply3), `turn 3 answers (${third.final?.type})`);
check(
  !flightQuestion(reply3).length,
  `turn 3 does not ask about or price flights (${JSON.stringify(flightQuestion(reply3))})`,
);
check(
  !/other (hotel|stay)|another (hotel|stay)|book (a|your) (hotel|stay)|酒店.*[?？]/i.test(reply3),
  "turn 3 does not suggest other stays",
);

const failed = results.filter((r) => !r.ok);
writeFileSync(
  `${OUT}/summary.json`,
  JSON.stringify(
    {
      run: RUN,
      mode: MODE,
      tripId,
      passed: results.length - failed.length,
      failed: failed.length,
      results,
      replies: [first, second, third].map((t) => t.final?.response?.reply ?? t.final?.question),
    },
    null,
    2,
  ),
);
console.log(`\n${results.length - failed.length}/${results.length} checks passed → ${OUT}`);
process.exit(failed.length ? 1 : 0);
