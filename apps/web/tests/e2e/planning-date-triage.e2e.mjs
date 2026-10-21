import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const out = resolve(
  process.cwd(),
  "output/e2e/planning-date-triage",
  process.env.RUN_ID ?? "latest",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name) => {
  checks.push({ ok: Boolean(ok), name });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
};
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const briefFor = (name, offset) => ({
  tripId: `dates-${name}`,
  userId: "e2e",
  destination: "Hobart",
  dates: [day(offset), day(offset + 1)],
  groupSize: 1,
  budgetTotal: 1800,
});
async function request(name, body) {
  const response = await fetch(`${process.env.BASE_URL ?? "http://localhost:3000"}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  writeFileSync(`${out}/${name}.ndjson`, raw);
  check(response.ok, `${name}: request succeeds`);
  return raw.trim().split("\n").map(JSON.parse).at(-1);
}
for (const [name, offset, expected] of [
  ["yesterday", -1, "ask_user"],
  ["today", 0, "complete"],
  ["future", 20, "complete"],
]) {
  const brief = briefFor(name, offset);
  const terminal = await request(name, {
    tripId: brief.tripId,
    message: "Plan this trip",
    mode: "plan",
    brief,
  });
  check(terminal.type === expected, `${name}: ${expected}`);
  if (expected === "ask_user")
    check(
      terminal.questions?.some((q) => q.id === "past-trip-dates"),
      "past dates receive an explicit date clarification",
    );
}
const chatBrief = briefFor("chat-past", -1);
const chat = await request("chat-past", {
  tripId: chatBrief.tripId,
  message: "Plan this trip",
  known: chatBrief,
});
check(chat.type === "ask_user", "past dates also clarify through the chat entry");
const dates = chatBrief.dates;
const confirmationTripId = "historical-confirmation";
const historicalBrief = { ...chatBrief, tripId: confirmationTripId };
const confirmationAsk = await request("historical-confirmation-ask", {
  tripId: confirmationTripId,
  message: "Plan this trip",
  mode: "plan",
  brief: historicalBrief,
});
check(confirmationAsk.type === "ask_user", "fresh historical trip asks before planning");
const ambiguous = await request("historical-confirmation-ambiguous", {
  tripId: confirmationTripId,
  message: "Yes",
  mode: "plan",
  brief: historicalBrief,
});
check(ambiguous.type === "ask_user", "ambiguous reply does not confirm historical dates");
const confirmed = await request("historical-confirmation-confirmed", {
  tripId: confirmationTripId,
  message: "Confirm historical trip",
  mode: "plan",
  brief: historicalBrief,
});
check(confirmed.type === "complete", "explicit reply confirms the same historical dates");
check(
  JSON.stringify(confirmed.response?.plan?.brief?.dates) === JSON.stringify(dates),
  "confirmed historical plan retains the entered dates",
);
const unpromptedTripId = "historical-confirmation-unprompted";
const unprompted = await request("historical-confirmation-unprompted", {
  tripId: unpromptedTripId,
  message: "Confirm historical trip",
  mode: "plan",
  brief: { ...historicalBrief, tripId: unpromptedTripId },
});
check(unprompted.type === "ask_user", "confirmation without a matching prompt remains blocked");
const multilineConfirmationTripId = "historical-multiline-confirmation";
const multilineBrief = { ...chatBrief, tripId: multilineConfirmationTripId };
const multilineAsk = await request("historical-multiline-confirmation-ask", {
  tripId: multilineConfirmationTripId,
  message: "Plan this trip",
  mode: "plan",
  brief: multilineBrief,
});
check(
  multilineAsk.type === "ask_user",
  "multiline confirmation starts with the matching date card",
);
const multilineConfirmed = await request("historical-multiline-confirmation-reply", {
  tripId: multilineConfirmationTripId,
  message: "Dates: Confirm historical trip\nTrip dates: no preference",
  mode: "plan",
  brief: multilineBrief,
});
check(
  multilineConfirmed.type === "complete",
  "real multiline card answer confirms the historical trip",
  { type: multilineConfirmed.type, reply: multilineConfirmed.response?.reply },
);
check(
  JSON.stringify(multilineConfirmed.response?.plan?.brief?.dates) === JSON.stringify(dates),
  "multiline confirmation retains the entered dates",
);
const chineseTripId = "historical-multiline-confirmation-zh";
const chineseBrief = { ...chatBrief, tripId: chineseTripId };
const chineseAsk = await request("historical-multiline-confirmation-ask-zh", {
  tripId: chineseTripId,
  message: "规划这次行程",
  mode: "plan",
  brief: chineseBrief,
  interfaceLanguage: "zh",
});
check(chineseAsk.type === "ask_user", "Chinese historical trip asks for confirmation");
const chineseConfirmed = await request("historical-multiline-confirmation-reply-zh", {
  tripId: chineseTripId,
  message: "日期: 确认历史行程\n旅行日期: 无偏好",
  mode: "plan",
  brief: chineseBrief,
  interfaceLanguage: "zh",
});
check(
  chineseConfirmed.type === "complete",
  "Chinese multiline card answer confirms historical dates",
);
check(
  JSON.stringify(chineseConfirmed.response?.plan?.brief?.dates) === JSON.stringify(dates),
  "Chinese multiline confirmation retains the entered dates",
);
const correctionTripId = "historical-date-correction";
const correctionBrief = { ...chatBrief, tripId: correctionTripId };
const correctionAsk = await request("historical-correction-ask", {
  tripId: correctionTripId,
  message: "Plan this trip",
  mode: "plan",
  brief: correctionBrief,
});
check(correctionAsk.type === "ask_user", "date correction starts with clarification");
const correctedDates = [day(20), day(21)];
const corrected = await request("historical-correction-applied", {
  tripId: correctionTripId,
  message: "Use these corrected future dates",
  mode: "plan",
  brief: { ...correctionBrief, dates: correctedDates },
});
check(corrected.type === "complete", "corrected future dates proceed");
check(
  JSON.stringify(corrected.response?.plan?.brief?.dates) === JSON.stringify(correctedDates),
  "corrected dates are reflected in the completed plan",
);
const future = briefFor("historical-edit", 20);
const seed = await request("historical-seed", {
  tripId: future.tripId,
  message: "Plan this trip",
  mode: "plan",
  brief: future,
});
if (seed.type === "complete") {
  const historical = {
    ...seed.response.plan,
    brief: { ...seed.response.plan.brief, dates: [day(-20), day(-19)] },
  };
  const edited = await request("historical-edit", {
    tripId: future.tripId,
    message: "Keep this trip unchanged",
    mode: "plan",
    brief: historical.brief,
    plan: historical,
  });
  check(edited.type === "complete", "existing historical trip remains editable");
} else check(false, "historical fixture seed completes");
writeFileSync(`${out}/summary.json`, JSON.stringify({ checks }, null, 2));
process.exitCode = checks.some((c) => !c.ok) ? 1 : 0;
