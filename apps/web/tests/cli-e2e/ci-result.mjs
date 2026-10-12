import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { validatePlan } from "./runner-plan.mjs";

try {
  const [action, ...args] = process.argv.slice(2);
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !["--plan", "--results", "--shard", "--output"].includes(flag) ||
      options.has(flag) ||
      !value ||
      value.startsWith("--")
    )
      throw new Error("Expected a plan path and optional results directory");
    options.set(flag, value);
  }
  if (!options.has("--plan")) throw new Error("Missing plan");
  const entries = readdirSync(import.meta.dirname, { withFileTypes: true }).filter(
    (entry) => entry.name.endsWith(".e2e.mjs") || entry.name === "report-cli.mjs",
  );
  if (entries.some((entry) => !entry.isFile()))
    throw new Error("Acceptance inventory must contain regular files");
  const inventory = entries.map((entry) => entry.name).sort();
  const rawPlan = readFileSync(resolve(options.get("--plan")), "utf8");
  const plan = validatePlan(JSON.parse(rawPlan), inventory);
  if (
    plan.mode === "skip" &&
    (![plan.base, plan.head].every((value) => typeof value === "string" && value.length > 0) ||
      plan.matchedRules.some(
        (rule) => rule.rule !== "ordinary-documentation" || rule.scripts.length,
      ) ||
      JSON.stringify(plan.changedFiles) !==
        JSON.stringify(plan.matchedRules.map((rule) => rule.path)))
  )
    throw new Error("Skip requires a verified comparison with only ordinary documentation rules");
  const planSha256 = createHash("sha256").update(rawPlan).digest("hex");
  if (action === "plan") {
    const matrix = JSON.stringify({ shard: plan.shards.map((shard) => shard.id) });
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `run-workers=${plan.mode !== "skip"}\nmatrix=${matrix}\n`,
    );
  } else if (action === "worker") {
    const shard = options.get("--shard");
    if (!plan.shards.some((candidate) => candidate.id === shard))
      throw new Error("Unknown worker shard");
    if (!["success", "failure", "cancelled"].includes(process.env.WORKER_RESULT))
      throw new Error("Invalid worker result");
    const file = resolve(options.get("--output"));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      `${JSON.stringify({ schemaVersion: 1, shard, result: process.env.WORKER_RESULT, planSha256 })}\n`,
    );
  } else if (action === "aggregate") {
    if (process.env.PLAN_RESULT !== "success") throw new Error("Planning did not succeed");
    const directory = resolve(options.get("--results"));
    const receipts = existsSync(directory)
      ? readdirSync(directory, { recursive: true })
          .filter((name) => name.endsWith(".json"))
          .map((name) => JSON.parse(readFileSync(resolve(directory, name), "utf8")))
      : [];
    if (plan.mode === "skip") {
      if (process.env.WORKERS_RESULT !== "skipped" || receipts.length)
        throw new Error("Expected an explicit skip with skipped workers and no receipts");
      console.log(`CLI acceptance skipped: ${plan.reason}`);
    } else {
      if (process.env.WORKERS_RESULT !== "success") throw new Error("Workers did not succeed");
      if (
        receipts.length !== plan.shards.length ||
        new Set(receipts.map((receipt) => receipt.shard)).size !== receipts.length ||
        receipts.some(
          (receipt) =>
            receipt.schemaVersion !== 1 ||
            receipt.result !== "success" ||
            receipt.planSha256 !== planSha256 ||
            !plan.shards.some((shard) => shard.id === receipt.shard),
        )
      )
        throw new Error("Missing or unsuccessful planned worker receipt");
      console.log(`CLI acceptance passed: ${receipts.length} planned workers`);
    }
  } else throw new Error("Expected plan, worker or aggregate command");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
