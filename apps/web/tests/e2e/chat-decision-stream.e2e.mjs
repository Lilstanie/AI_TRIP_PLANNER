import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve("output/e2e/chat-decision-stream", process.env.LABEL ?? "after");
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];

async function planTurn(name, budgetTotal) {
  const brief = {
    tripId: name,
    userId: "e2e",
    origin: "Sydney",
    destination: "Tokyo",
    dates: ["2027-02-01", "2027-02-07"],
    groupSize: 2,
    budgetTotal,
  };
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({ tripId: name, mode: "plan", message: "Plan my trip", brief }),
  });
  const text = await response.text();
  writeFileSync(`${out}/${name}.ndjson`, text);
  assert.equal(response.ok, true);
  return text.trim().split("\n").map(JSON.parse);
}

const decisions = (events) => events.filter((event) => event.type === "decision");

try {
  const tight = await planTurn("tight-budget", 2800);
  const tightDecisions = decisions(tight).map((event) => event.decision);
  const order = tightDecisions.map((decision) => decision.type);
  assert.ok(order.includes("conflicts_detected"), `no conflicts_detected in ${order}`);
  assert.ok(order.includes("revision_started"), `no revision_started in ${order}`);
  assert.ok(order.includes("revision_scored"), `no revision_scored in ${order}`);
  assert.equal(order.at(-1), "loop_stopped");
  assert.ok(order.indexOf("conflicts_detected") < order.indexOf("revision_started"));
  assert.ok(order.indexOf("revision_started") < order.indexOf("revision_scored"));
  assert.ok(order.indexOf("revision_scored") < order.lastIndexOf("loop_stopped"));
  const conflict = tightDecisions.find((decision) => decision.type === "conflicts_detected");
  assert.ok(conflict.conflicts.length > 0);
  assert.ok(conflict.conflicts.every((entry) => typeof entry.agent === "string"));
  const scored = tightDecisions.find((decision) => decision.type === "revision_scored");
  assert.equal(typeof scored.scoreBefore, "number");
  assert.equal(typeof scored.scoreAfter, "number");
  assert.equal(typeof scored.kept, "boolean");
  assert.ok(
    ["converged", "round_limit", "infeasible_budget", "no_improvement"].includes(
      tightDecisions.at(-1).reason,
    ),
  );
  assert.ok(tight.some((event) => event.type === "coordinator"));
  assert.equal(tight.at(-1).type, "complete");
  results.push({ check: "tight budget streams conflict, revision, score, stop in order", order });

  const easy = await planTurn("easy-budget", 20000);
  const easyDecisions = decisions(easy).map((event) => event.decision);
  const stop = easyDecisions.find((decision) => decision.type === "loop_stopped");
  assert.ok(stop, "no loop_stopped");
  assert.equal(stop.reason, "converged");
  assert.equal(stop.round, 1);
  assert.ok(!easyDecisions.some((decision) => decision.type === "revision_started"));
  results.push({ check: "no conflict streams loop_stopped converged in round 1" });
} finally {
  writeFileSync(`${out}/result.json`, JSON.stringify({ results }, null, 2));
}
console.log(JSON.stringify(results, null, 2));
