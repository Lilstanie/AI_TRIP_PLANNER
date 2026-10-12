import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
const unique = (value) => new Set(value).size === value.length;
const safeScript = (value) =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*\.mjs$/.test(value);
const requireValid = (condition, message) => {
  if (!condition) throw new Error(message);
};

export function loadSelection(args, inventory) {
  requireValid(
    inventory.length > 0 && inventory.every(safeScript),
    "Empty or unsafe acceptance inventory",
  );
  if (!args.length) return { scripts: inventory };
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    requireValid(
      ["--plan", "--shard"].includes(flag) &&
        !options.has(flag) &&
        typeof value === "string" &&
        value.length > 0 &&
        !value.startsWith("--"),
      "Expected --plan <plan.json> --shard <id>",
    );
    options.set(flag, value);
  }
  requireValid(options.size === 2, "Both --plan and --shard are required");
  const planPath = resolve(options.get("--plan"));
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  requireValid(object(plan) && plan.schemaVersion === 1, "Unsupported plan schema");
  requireValid(["full", "selected", "skip"].includes(plan.mode), "Invalid plan mode");
  requireValid(
    typeof plan.reason === "string" &&
      [plan.base, plan.head].every((value) => value === null || typeof value === "string") &&
      strings(plan.changedFiles) &&
      Array.isArray(plan.matchedRules) &&
      plan.matchedRules.every(
        (rule) =>
          object(rule) &&
          typeof rule.path === "string" &&
          typeof rule.rule === "string" &&
          strings(rule.scripts),
      ),
    "Invalid plan decision metadata",
  );
  requireValid(
    strings(plan.discoveredScripts) &&
      plan.discoveredScripts.length > 0 &&
      unique(plan.discoveredScripts) &&
      plan.discoveredScripts.every(safeScript) &&
      JSON.stringify(plan.discoveredScripts) === JSON.stringify(inventory),
    "Plan inventory must equal the complete sorted current inventory",
  );
  requireValid(
    strings(plan.selectedScripts) &&
      unique(plan.selectedScripts) &&
      plan.selectedScripts.every((script) => safeScript(script) && inventory.includes(script)),
    "Selected scripts must be unique discovered basenames",
  );
  requireValid(Array.isArray(plan.shards), "Invalid shards");
  if (plan.mode === "skip") {
    requireValid(
      plan.selectedScripts.length === 0 && plan.shards.length === 0,
      "Invalid skip plan",
    );
    throw new Error("Skip plans cannot execute a worker");
  }
  requireValid(plan.selectedScripts.length > 0, "Worker selection must not be empty");
  if (plan.mode === "full")
    requireValid(
      plan.selectedScripts.length === inventory.length,
      "Full plan must select complete inventory",
    );
  requireValid(
    plan.shards.length >= 1 &&
      plan.shards.length <= 3 &&
      plan.shards.every(
        (shard) =>
          object(shard) &&
          typeof shard.id === "string" &&
          shard.id.trim().length > 0 &&
          !/[\x00-\x1f\x7f]/.test(shard.id) &&
          strings(shard.scripts) &&
          shard.scripts.length > 0,
      ),
    "Expected 1-3 nonempty identified shards",
  );
  requireValid(unique(plan.shards.map((shard) => shard.id)), "Shard identities must be unique");
  const assigned = plan.shards.flatMap((shard) => shard.scripts);
  requireValid(
    unique(assigned) &&
      assigned.length === plan.selectedScripts.length &&
      assigned.every((script) => safeScript(script) && plan.selectedScripts.includes(script)),
    "Shard partition must assign every selected script exactly once",
  );
  const shard = plan.shards.find((candidate) => candidate.id === options.get("--shard"));
  requireValid(shard, "Unknown shard identity");
  return { scripts: shard.scripts, plan, planPath, shard: shard.id };
}
