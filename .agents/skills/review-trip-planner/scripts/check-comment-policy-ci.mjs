import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const options = {};
const report = { paths: [], violations: [], allowed: [], outcome: "error", exitCode: 2 };
const checker = resolve(dirname(fileURLToPath(import.meta.url)), "check-added-comments.mjs");
let temporary;
try {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!["--event", "--base", "--head", "--output"].includes(key) || !args[i + 1] || options[key])
      throw new Error(
        "Usage: --event <pull_request|push> --base <sha> --head <sha> --output <json>",
      );
    options[key] = args[i + 1];
  }
  for (const key of ["--event", "--base", "--head", "--output"])
    if (!options[key]) throw new Error(`Missing ${key}`);
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8", timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
  if (resolve(git("rev-parse", "--show-toplevel").trim()) !== resolve(process.cwd()))
    throw new Error("Run from the repository root");
  if (!["pull_request", "push"].includes(options["--event"])) throw new Error("Unsupported event");
  for (const key of ["--base", "--head"])
    if (!/^[a-f0-9]{40}$/.test(options[key]) || /^0+$/.test(options[key]))
      throw new Error(`Invalid ${key} SHA`);
  const commit = (sha) =>
    git("rev-parse", "--verify", "--end-of-options", `${sha}^{commit}`).trim();
  const head = commit(options["--head"]);
  const before = commit(options["--base"]);
  if (git("rev-parse", "HEAD").trim() !== head)
    throw new Error("Checkout must match the event head");
  git("diff", "--quiet", "HEAD", "--");
  let base;
  if (options["--event"] === "pull_request") base = git("merge-base", before, head).trim();
  else {
    git("merge-base", "--is-ancestor", before, head);
    base = before;
  }
  Object.assign(report, { event: options["--event"], before, base, head });
  const config = ".agents/skills/review-trip-planner/assets/comment-exceptions.json";
  if (!lstatSync(config).isFile() || lstatSync(config).isSymbolicLink())
    throw new Error("Exceptions must be an ordinary file");
  const entries = JSON.parse(readFileSync(config, "utf8"));
  if (!Array.isArray(entries)) throw new Error("Exceptions must be an array");
  const seen = new Set();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.file !== "string" ||
      isAbsolute(entry.file) ||
      entry.file.split("/").some((p) => !p || p === "." || p === "..") ||
      entry.file.startsWith(".git/") ||
      !/\.(?:[cm]?[jt]s|[jt]sx)$/.test(entry.file) ||
      typeof entry.text !== "string" ||
      !entry.text.trim() ||
      typeof entry.reason !== "string" ||
      !entry.reason.trim()
    )
      throw new Error("Every exception needs a literal JS/TS path, exact text and reason");
    const key = JSON.stringify([entry.file, entry.text]);
    if (seen.has(key)) throw new Error("Duplicate exception");
    seen.add(key);
  }
  const parts = git(
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--name-status",
    "-z",
    "--find-renames",
    base,
    head,
    "--",
  ).split("\0");
  const selected = [];
  for (let i = 0; i < parts.length - 1;) {
    const status = parts[i++];
    const from = parts[i++];
    const file = /^[RC]/.test(status) ? parts[i++] : from;
    if (!file) throw new Error("Malformed Git path record");
    if (status === "D" || !/\.(?:[cm]?[jt]s|[jt]sx)$/.test(file)) continue;
    selected.push({ file, from: status.startsWith("R") ? from : undefined });
  }
  report.paths = selected.map(({ file }) => file);
  temporary = mkdtempSync(resolve(tmpdir(), "trip-comment-policy-"));
  for (const { file, from } of selected) {
    const exceptions = resolve(temporary, "exceptions.json");
    writeFileSync(exceptions, JSON.stringify(entries.filter((entry) => entry.file === file)));
    const args = [checker, "--base", base, "--path", file, "--exceptions", exceptions];
    if (from) args.push("--base-path", from);
    const child = spawnSync(process.execPath, args, {
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 32 * 1024 * 1024,
    });
    if (![0, 1].includes(child.status))
      throw new Error(
        `Checker failed for ${JSON.stringify(file)}: ${child.stderr || child.error || child.signal}`,
      );
    const result = JSON.parse(child.stdout);
    if (
      result.base !== base ||
      result.head !== head ||
      !Array.isArray(result.violations) ||
      !Array.isArray(result.allowed)
    )
      throw new Error("Invalid checker report");
    report.violations.push(...result.violations);
    report.allowed.push(...result.allowed);
  }
  report.exitCode = report.violations.length ? 1 : 0;
  report.outcome = report.violations.length ? "failed" : selected.length ? "passed" : "skipped";
} catch (error) {
  report.error = error.message;
  process.stderr.write(`${error.message}\n`);
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
  if (options["--output"]) {
    try {
      const output = resolve(options["--output"]);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    } catch (error) {
      report.exitCode = 2;
      process.stderr.write(`${error.message}\n`);
    }
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.exitCode;
}
