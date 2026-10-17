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
