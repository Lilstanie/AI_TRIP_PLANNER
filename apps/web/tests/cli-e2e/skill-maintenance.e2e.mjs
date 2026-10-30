import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const failureModes = [
  "helper and partial edits erase outstanding activity",
  "missing invalid uncommitted unreachable or shallow checkpoint resets reminders",
  "bare references exclude issues without coverage and substantive evidence",
  "threshold boundaries human JSON and exit codes drift",
  "merged pulls count as closed-unmerged",
  "remote errors malformed responses or pagination become zero or crash",
  "broken paths and commands stop being independently actionable",
  "checkpoint location violates the repository skill layout",
];
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const output = mkdtempSync(resolve(tmpdir(), "skill-maintenance-acceptance-"));
const results = [];
const checkpointPath = ".agents/skills/skill-maintenance/assets/review-checkpoint.json";
function fixture() {
  const cwd = mkdtempSync(resolve(output, "repo-"));
  const write = (path, data) => {
    mkdirSync(dirname(resolve(cwd, path)), { recursive: true });
    writeFileSync(resolve(cwd, path), typeof data === "string" ? data : JSON.stringify(data));
  };
  let tick = 0;
  const git = (...args) => {
    const date = new Date(Date.UTC(2020, 0, 1) + tick * 1000).toISOString();
    if (args.includes("commit")) tick++;
    const r = spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: 10000,
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", "/dev/null");
  git("remote", "add", "origin", "https://github.com/fixture/repo.git");
  cpSync(
    resolve(root, ".agents/skills/skill-maintenance/scripts"),
    resolve(cwd, ".agents/skills/skill-maintenance/scripts"),
    { recursive: true },
  );
  write(
    ".agents/skills/skill-maintenance/SKILL.md",
    "---\nname: skill-maintenance\ndescription: Fixture\n---\nFixture skill.\n",
  );
  write("package.json", { scripts: {} });
  write("evidence.md", "All skills and accepted outcomes inspected; fixture only.\n");
  const commit = (message) => {
    git("add", ".");
    git("commit", "-qm", message);
    return git("rev-parse", "HEAD");
  };
  const base = commit("initial fixture");
  const record = (revision = base, reviewedIssues = []) => ({
    version: 1,
    reviewedRevision: revision,
    skills: [
      {
        name: "skill-maintenance",
        summary: "Inspected CLI commands and thresholds against accepted outcomes.",
      },
    ],
    reviewedIssues,
  });
  const checkpoint = (revision = base, reviewedIssues = []) => {
    write(checkpointPath, record(revision, reviewedIssues));
    return commit("Record completed full skill review");
  };
  const bin = mkdtempSync(resolve(output, "stub-bin-"));
  writeFileSync(
    resolve(bin, "curl"),
    `#!${process.execPath}\nconst fs=require('node:fs'); const config=JSON.parse(fs.readFileSync(process.env.STUB_RESPONSES)); if(config.transport) process.exit(7); const url=new URL(process.argv.at(-1)); const page=Number(url.searchParams.get('page')||1); const value=url.pathname.includes('/pulls/') ? config.pulls?.[url.pathname.split('/').at(-1)] : (config.pages?.[page-1] ?? []); const body=config.raw ?? JSON.stringify(value ?? {}); process.stdout.write(body+'\\n'+(config.status||200));\n`,
  );
  spawnSync("chmod", ["+x", resolve(bin, "curl")]);
  const remoteFile = resolve(bin, "remote.json");
  writeFileSync(remoteFile, "{}");
  const fixtureWrite = (path, data) =>
    path === "remote.json" ? writeFileSync(remoteFile, JSON.stringify(data)) : write(path, data);
  const run = (name, expected, args = ["--json"], command = "is-due.mjs") => {
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      STUB_RESPONSES: remoteFile,
      GITHUB_TOKEN: "",
    };
    const argv = [resolve(cwd, ".agents/skills/skill-maintenance/scripts", command), ...args];
    const r = spawnSync(process.execPath, argv, { cwd, env, encoding: "utf8", timeout: 30000 });
    const evidence = {
      name,
      cwd,
      argv,
      status: r.status,
      signal: r.signal,
      stdout: r.stdout,
      stderr: r.stderr,
      history: spawnSync("git", ["log", "--all", "--oneline"], {
        cwd,
        encoding: "utf8",
        timeout: 10000,
      })
        .output.slice(1)
        .join(""),
    };
    results.push(evidence);
    writeFileSync(
      resolve(output, "summary.json"),
      JSON.stringify({ failureModes, results }, null, 2),
    );
    assert.equal(r.status, expected, JSON.stringify(evidence));
    return args.includes("--json") ? JSON.parse(r.stdout) : r.stdout;
  };
  return { cwd, write: fixtureWrite, git, commit, base, record, checkpoint, run };
}

const f = fixture();
f.checkpoint();
for (let i = 1; i <= 8; i++) {
  f.write("work.txt", String(i));
  f.commit(`Delivered change (#${i})`);
}
f.write(".agents/skills/skill-maintenance/scripts/helper.txt", "helper only");
f.commit("Helper update mentions #77");
assert.equal(f.run("helper-only edit retains eight PRs", 10).signals.mergedPRs.length, 8);
f.write(".agents/skills/skill-maintenance/SKILL.md", "Partial correction.\n");
f.commit("Partial skill correction");
assert.equal(f.run("partial edit retains eight PRs", 10).signals.mergedPRs.length, 8);
f.checkpoint(f.git("rev-parse", "HEAD"));
assert.equal(f.run("explicit completed review advances checkpoint", 0).signals.mergedPRs.length, 0);
assert.match(f.run("human not due output", 0, []), /No review due/);

const absent = fixture();
assert.equal(absent.run("absent checkpoint requires review", 10).baseline, null);
absent.write(checkpointPath, absent.record());
assert.equal(absent.run("uncommitted checkpoint cannot reset", 10).baseline, null);
for (const [name, alter] of [
  ["malformed checkpoint", () => "{"],
  ["unreachable revision", (r) => ({ ...r, reviewedRevision: "f".repeat(40) })],
  ["partial coverage", (r) => ({ ...r, skills: [] })],
  ["bare Issue exclusion", (r) => ({ ...r, reviewedIssues: [77] })],
  [
    "missing evidence",
    (r) => ({
      ...r,
      reviewedIssues: [
        {
          number: 77,
          reason: "Inspected the issue against the current owning skill.",
          evidence: ["missing.md"],
        },
      ],
    }),
  ],
]) {
  const c = fixture();
  c.write(checkpointPath, alter(c.record()));
  c.commit(name);
  assert.equal(c.run(name, 10).baseline, null);
}
const nonancestor = fixture();
nonancestor.git("checkout", "--orphan", "unrelated");
nonancestor.git("rm", "-rf", ".");
nonancestor.write("other.txt", "unrelated history");
const unrelated = nonancestor.commit("unrelated root");
nonancestor.git("checkout", "main");
nonancestor.checkpoint(unrelated);
assert.equal(nonancestor.run("nonancestor history rejected", 10).baseline, null);
const shallow = fixture();
shallow.checkpoint();
shallow.write(".git/shallow", shallow.base + "\n");
assert.match(shallow.run("shallow history is conservative", 10).checkpoint.reason, /shallow/);
const incomplete = fixture();
incomplete.checkpoint();
incomplete.write(".agents/skills/new-skill/SKILL.md", "New skill.\n");
incomplete.commit("Add unreviewed skill");
assert.equal(incomplete.run("new skill needs full coverage", 10).baseline, null);
const missingOrigin = fixture();
missingOrigin.checkpoint();
missingOrigin.git("remote", "remove", "origin");
missingOrigin.write("AGENTS.md", "New convention");
missingOrigin.commit("Convention update");
const local = missingOrigin.run("missing origin retains Git signals", 10);
assert.equal(local.signals.conventionChanges.length, 1);
assert.equal(local.signals.closedIssues, null);

const closed = (number, extra = {}) => ({
  number,
  title: `Fixture ${number}`,
  closed_at: "2030-01-01T00:00:00Z",
  ...extra,
});
const classification = fixture();
classification.checkpoint();
classification.write("remote.json", {
  pages: [
    [
      closed(91, { pull_request: { url: "fixture" } }),
      closed(92, { pull_request: { url: "fixture" } }),
    ],
  ],
  pulls: { 91: { merged_at: "2030-01-01T00:00:00Z" }, 92: { merged_at: null } },
});
assert.equal(
  classification.run("merged PR detail excluded from unmerged count", 0).signals.unmergedPRs.length,
  1,
);
classification.write("remote.json", {
  pages: [[closed(93, { pull_request: { merged_at: "2030-01-01T00:00:00Z" } })]],
});
assert.equal(
  classification.run("list merged marker is sufficient", 0).signals.unmergedPRs.length,
  0,
);
const exclusions = fixture();
exclusions.write("work.txt", "issue reference");
exclusions.commit("Only mentions #77");
exclusions.checkpoint(exclusions.base, [
  {
    number: 78,
    reason: "Reviewed the failure and retained the accepted command boundary.",
    evidence: ["evidence.md"],
  },
]);
exclusions.write("remote.json", {
  pages: [[closed(77), closed(78, { closed_at: "2020-01-01T00:00:00.500Z" })]],
});
assert.deepEqual(
  exclusions.run("explicit reviewed issue excluded bare mention retained", 0).signals.closedIssues,
  ["#77 Fixture 77"],
);
exclusions.write("remote.json", { pages: [[closed(78)]] });
assert.equal(
  exclusions.run("reclosed issue after checkpoint counts again", 0).signals.closedIssues.length,
  1,
);
for (const [name, config] of [
  ["HTTP failure", { status: 503 }],
  ["malformed JSON", { raw: "{" }],
  ["nonarray issues", { raw: "{}" }],
  ["null issue", { pages: [[null]] }],
  ["invalid closure date", { pages: [[closed(1, { closed_at: "invalid" })]] }],
]) {
  const c = fixture();
  c.checkpoint();
  c.write("remote.json", config);
  const r = c.run(name, 0);
  assert.equal(r.signals.closedIssues, null);
  assert.notEqual(r.github, "ok");
  assert.match(c.run(`${name} human unavailable`, 0, []), /unavailable/);
}
const details = fixture();
details.checkpoint();
details.write("remote.json", {
  pages: [[closed(1), closed(2, { pull_request: {} })]],
  pulls: { 2: {} },
});
const detailResult = details.run("malformed PR details preserve measured issues", 0);
assert.equal(detailResult.signals.closedIssues.length, 1);
assert.equal(detailResult.signals.unmergedPRs, null);
const pages = fixture();
pages.checkpoint();
const olderPages = Array.from({ length: 10 }, (_, page) =>
  Array.from({ length: 100 }, (_, i) =>
    closed(page * 100 + i + 1, { closed_at: "2019-01-01T00:00:00Z" }),
  ),
);
pages.write("remote.json", {
  pages: [...olderPages, Array.from({ length: 5 }, (_, i) => closed(1001 + i))],
});
assert.equal(pages.run("activity on page eleven is counted", 10).signals.closedIssues.length, 5);
pages.write("remote.json", { pages: [olderPages[0], olderPages[0]] });
assert.equal(pages.run("repeated pagination explicitly unavailable", 0).signals.closedIssues, null);

for (const [signal, limit, path] of [
  ["mergedPRs", 8, "work.txt"],
  ["conventionChanges", 1, "AGENTS.md"],
  ["noteChanges", 2, ".agents/notes/implemented/process/example.md"],
]) {
  const c = fixture();
  c.checkpoint();
  for (let i = 1; i < limit; i++) {
    c.write(path, String(i));
    c.commit(signal === "mergedPRs" ? `Squash delivery (#${i})` : `Update ${signal} ${i}`);
  }
  assert.equal(c.run(`${signal} below boundary`, 0).signals[signal].length, limit - 1);
  c.write(path, "boundary");
  c.commit(signal === "mergedPRs" ? "Squash boundary (#80)" : `Update ${signal} boundary`);
  assert.equal(c.run(`${signal} at boundary`, 10).signals[signal].length, limit);
  assert.match(c.run(`${signal} human due`, 10, []), /Review due/);
}
for (const [signal, limit] of [
  ["closedIssues", 5],
  ["unmergedPRs", 2],
]) {
  const c = fixture();
  c.checkpoint();
  const items = Array.from({ length: limit }, (_, i) =>
    closed(i + 1, signal === "unmergedPRs" ? { pull_request: { merged_at: null } } : {}),
  );
  c.write("remote.json", { pages: [items.slice(1)] });
  assert.equal(c.run(`${signal} below boundary`, 0).signals[signal].length, limit - 1);
  c.write("remote.json", { pages: [items] });
  assert.equal(c.run(`${signal} at boundary`, 10).signals[signal].length, limit);
}
const merge = fixture();
merge.checkpoint();
merge.git("checkout", "-qb", "feature");
merge.write("feature.txt", "branch change");
merge.commit("Branch implementation");
merge.git("checkout", "main");
merge.git("merge", "--no-ff", "feature", "-m", "Merge pull request #81 from fixture/feature");
assert.equal(
  merge.run("merge history counted with overridden PR threshold", 10, ["--json", "--prs", "1"])
    .signals.mergedPRs.length,
  1,
);
assert.equal(merge.run("merge below default threshold", 0).signals.mergedPRs.length, 1);
const broken = fixture();
broken.checkpoint();
broken.write(
  ".agents/skills/skill-maintenance/SKILL.md",
  'Missing `apps/web/missing.ts`, `docs/missing.md` and `pnpm missing-command`. Examples: `feature/TP-72-trajectory-tab`, `+additions/-deletions`, `fetch("/orders`.\n',
);
broken.commit("Partial edit with broken references");
const drift = broken.run(
  "drift JSON reports public path and command errors",
  1,
  ["--json"],
  "check-skills.mjs",
);
assert.deepEqual(drift.skills[0].missingPaths, ["apps/web/missing.ts", "docs/missing.md"]);
assert.equal(drift.skills[0].brokenScripts.length, 1);
assert.match(
  broken.run("drift human reports missing path", 1, [], "check-skills.mjs"),
  /missing path/,
);
assert.match(
  broken.run("broken references independently due", 10).reasons.join(" "),
  /broken paths or commands/,
);
const transport = fixture();
transport.checkpoint();
transport.write("remote.json", { transport: true });
assert.equal(transport.run("curl transport failure is unavailable", 0).signals.closedIssues, null);
transport.write("AGENTS.md", "local convention");
transport.commit("Local change while remote unavailable");
assert.equal(
  transport.run("transport failure retains local due", 10).signals.conventionChanges.length,
  1,
);
const history = fixture();
history.checkpoint();
history.write("work.txt", "after checkpoint");
history.commit("More history");
unlinkSync(resolve(history.cwd, ".git/objects", history.base.slice(0, 2), history.base.slice(2)));
const unavailableHistory = history.run("missing history objects conservatively due", 10);
assert.equal(unavailableHistory.baseline, null);
assert.equal(unavailableHistory.signals.mergedPRs, null);
const missingDrift = fixture();
missingDrift.checkpoint();
unlinkSync(resolve(missingDrift.cwd, ".agents/skills/skill-maintenance/scripts/check-skills.mjs"));
assert.match(
  missingDrift.run("unavailable drift command cannot look clean", 10).reasons.join(" "),
  /drift.*unavailable/i,
);

for (const [name, config] of [
  ["numeric closure date", { pages: [[closed(1, { closed_at: 0 })]] }],
  ["array PR marker", { pages: [[closed(1, { pull_request: [] })]] }],
  ["numeric PR merge date", { pages: [[closed(1, { pull_request: { merged_at: 0 } })]] }],
]) {
  const c = fixture();
  c.checkpoint();
  c.write("remote.json", config);
  const r = c.run(name, 0);
  assert.notEqual(r.github, "ok");
}
const rejected = fixture();
rejected.checkpoint();
for (let i = 0; i < 2; i++) {
  rejected.write(`.agents/notes/rejected/process/fixture-${i}.md`, "Rejected proposal");
  rejected.commit("Record rejected proposal");
}
assert.equal(
  rejected.run("rejected proposals are not implemented notes", 0).signals.noteChanges.length,
  0,
);
const gap = fixture();
gap.write("work.txt", "after reviewed revision");
gap.commit("Unreviewed delivery (#82)");
gap.checkpoint(gap.base);
assert.equal(
  gap.run("record commit cannot absorb revision gap", 10, ["--json", "--prs", "1"]).signals
    .mergedPRs.length,
  1,
);
const validDrift = fixture();
validDrift.checkpoint();
assert.equal(
  validDrift.run("clean drift JSON", 0, ["--json"], "check-skills.mjs").skills.length,
  1,
);
assert.match(
  validDrift.run("clean drift human", 0, [], "check-skills.mjs"),
  /match the repository/,
);
const { checkSkills } = await import(resolve(root, "scripts/skill-rules.mjs"));
const layoutErrors = (cwd) =>
  checkSkills(resolve(cwd, ".agents/skills")).errors.filter((error) =>
    error.includes("review-checkpoint.json"),
  );
const layout = fixture();
layout.checkpoint();
const recorded = layoutErrors(layout.cwd);
const misplaced = fixture();
misplaced.write(".agents/skills/skill-maintenance/review-checkpoint.json", misplaced.record());
const control = layoutErrors(misplaced.cwd);
results.push({ name: "checkpoint passes skill layout", recorded, control });
writeFileSync(resolve(output, "summary.json"), JSON.stringify({ failureModes, results }, null, 2));
assert.deepEqual(recorded, []);
assert.equal(control.length, 1);
console.log(`${results.length} CLI cases passed; evidence: ${output}`);
