import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const out = resolve("output/e2e/planning-readiness", process.env.RUN_ID ?? "latest");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name) => {
  results.push({ ok: Boolean(ok), name });
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
};
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const brief = {
  tripId: `intake-http-${Date.now()}`,
  destination: "Trinidad and Tobago",
  dates: [day(20), day(21)],
  groupSize: 1,
  budgetTotal: 3000,
};
async function request(name, body) {
  const response = await fetch(`${process.env.BASE_URL ?? "http://localhost:3000"}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  writeFileSync(`${out}/${name}.ndjson`, raw);
  const events = raw.trim().split("\n").map(JSON.parse);
  check(response.ok, `${name}: request accepted`);
  return events.at(-1);
}
const ask = await request("plan-ambiguous", {
  tripId: brief.tripId,
  message: "Plan this trip",
  mode: "plan",
  brief,
});
check(
  ask.type === "ask_user" && ask.questions?.[0]?.id === "destination-conjunction",
  "plan mode clarifies ambiguous destination",
);
const full = await request("plan-full-name", {
  tripId: brief.tripId,
  message: "Destination: Trinidad and Tobago",
  mode: "plan",
  brief,
  known: ask.known,
});
check(full.type === "complete", "full place name selection proceeds");
const edited = await request("full-name-edit", {
  tripId: brief.tripId,
  message: "Keep this trip",
  mode: "plan",
  brief,
  plan: full.response?.plan,
});
check(edited.type === "complete", "editing an accepted full-name plan preserves destination");
const combined = { ...brief, tripId: `${brief.tripId}-combined`, dates: [day(-20), day(-19)] };
const combinedAsk = await request("combined-destination", {
  tripId: combined.tripId,
  message: "Plan this trip",
  mode: "plan",
  brief: combined,
});
check(
  combinedAsk.questions?.[0]?.id === "destination-conjunction",
  "combined trip clarifies destination first",
);
const combinedDates = await request("combined-dates", {
  tripId: combined.tripId,
  message: `Destination: ${combined.destination}`,
  mode: "plan",
  brief: combined,
  known: combinedAsk.known,
});
check(
  combinedDates.questions?.[0]?.id === "past-trip-dates",
  "confirmed destination advances to dates",
);
const combinedConfirmed = await request("combined-confirmed", {
  tripId: combined.tripId,
  message: "Confirm historical trip",
  mode: "plan",
  brief: combined,
  known: combinedDates.known,
});
check(
  combinedConfirmed.type === "complete",
  "date confirmation preserves the confirmed place name",
);
const historical = {
  ...brief,
  tripId: `${brief.tripId}-past`,
  destination: "Hobart",
  dates: [day(-20), day(-19)],
};
const past = await request("historical-ask", {
  tripId: historical.tripId,
  message: "Plan it",
  mode: "plan",
  brief: historical,
});
check(
  past.type === "ask_user" && past.questions?.[0]?.id === "past-trip-dates",
  "past dates ask before dispatch",
);
const mismatch = await request("historical-mismatch", {
  tripId: historical.tripId,
  message: "Confirm historical trip",
  mode: "plan",
  brief: { ...historical, dates: [day(-18), day(-17)] },
});
check(mismatch.type === "ask_user", "confirmation cannot approve different dates");
const confirmed = await request("historical-confirmed-chat", {
  tripId: historical.tripId,
  message: "Dates: Confirm historical trip",
  known: mismatch.known,
});
check(confirmed.type === "complete", "typed confirmation survives plan to offline chat");
check(
  JSON.stringify(confirmed.response?.plan.brief.dates) === JSON.stringify(mismatch.known?.dates),
  "confirmed dates are preserved",
);
const corrected = await request("future-correction", {
  tripId: historical.tripId,
  message: "Plan corrected dates",
  mode: "plan",
  brief: { ...historical, dates: brief.dates },
});
check(corrected.type === "complete", "future correction proceeds");
const missingId = `${brief.tripId}-missing`;
const partial = { destination: brief.destination, dates: brief.dates, groupSize: 1 };
const missingAsk = await request("missing-destination", {
  tripId: missingId,
  message: "Plan it",
  known: partial,
});
check(
  missingAsk.questions?.[0]?.id === "destination-conjunction",
  "partial brief clarifies destination",
);
const missingBudget = await request("missing-budget", {
  tripId: missingId,
  message: `Destination: ${brief.destination}`,
  known: missingAsk.known,
});
check(missingBudget.type === "needs_info", "UI destination answer advances to missing budget");
const budgetAdded = await request("missing-budget-added", {
  tripId: missingId,
  message: "Budget: 3000 AUD",
  known: { ...missingBudget.known, budgetTotal: 3000 },
});
check(budgetAdded.type === "complete", "confirmed destination survives the missing budget answer");
const memoryOff = await request("memory-off-mention", {
  tripId: `${brief.tripId}-memory`,
  message: "Suggest food",
  mentions: ["dining"],
  known: { learnedPreferences: ["Vegetarian"] },
  assistant: { style: "neutral", memory: false },
});
check(
  memoryOff.type === "needs_info" && memoryOff.known?.learnedPreferences === undefined,
  "memory-off mention excludes learned preferences",
);
writeFileSync(`${out}/checks.json`, JSON.stringify(results, null, 2));
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
