# Existing deterministic runner and report controls

Use these existing public acceptance scripts when the suspect boundary is runner execution or saved
report interpretation. They create isolated fixtures under ignored output directories and invoke real
CLI subprocesses. They do not exercise the application in Chromium or prove a browser assertion.

## Failure inventory and expected controls

Before running, record these expectations:

| Boundary        | Successful control                                                                                    | Deliberate failure and required observation                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw execution   | Existing `e-pass` fixture exits 0 and has an `ok` runner result.                                      | Existing `a-timeout` fixture exceeds its deadline: runner exits 1 and records `timedOut: true`, even though `b-survivor` subsequently passes.                                               |
| Escalation      | The next journey outlives the old escalation interval and passes.                                     | Existing `c-resistant` ignores SIGTERM: its own escalation stops it and the runner remains nonzero.                                                                                         |
| Setup/ownership | Synthetic Next servers use distinct owned build/config paths; legacy locks and shared config survive. | Removing executable permission from the fixture Next entrypoint produces EACCES and exit 2; a hard-killed owner cannot block a later successful allocation.                                 |
| Saved report    | A saved passing run reports `recordedOutcome: passed`, complete coverage and exit 0.                  | Saved failed/interrupted controls retain their outcome; interrupted coverage remains incomplete even with evidence and a later passing attempt. Report read exits 0 because reading worked. |

These failure modes are already implemented by the fixtures. Reuse them without editing a script,
dependency or product source. Each acceptance wrapper should exit 0 only when its controls behave as
expected; wrapper success does not mean the intentionally failing child passed.

## Reproduce

From the repository root, run serially on the selected Git baseline and then on the current tree:

```bash
git rev-parse HEAD
git status --short
node --version
pnpm --version
node apps/web/tests/cli-e2e/legacy-runner.e2e.mjs
node apps/web/tests/cli-e2e/report-interrupted.e2e.mjs
```

Capture each command's stdout, stderr and exit immediately in separate baseline/current files. The
scripts print an `evidenceFile` pointing at their retained JSON summary. The raw-runner fixture saves
child arguments, controlled environment, exit/signal, stdout/stderr, fixture events and runner
summaries. The report fixture saves CLI commands, raw JSON responses and named check results, as well
as the original saved records and evidence files.

No pnpm dependencies or browser installation are needed by these two fixture probes: the runner
fixture supplies its own synthetic Next executable and Playwright resolver inside its output tree.
It runs loopback HTTP servers and does not read dotenv contents or use real credentials. Node and
local process/permission semantics must support the existing POSIX controls. It is not Windows
acceptance. The raw fixture sets journey deadlines (15 seconds normally, 1 second for the resistant
child) and a 45-second deadline per runner invocation; escalation may add 10 seconds. The report
fixture bounds each CLI subprocess at 10 seconds. The wrapper includes several invocations, so its
overall duration exceeds any individual child limit.

Inspect the eight raw-runner named checks and seven report named checks independently. These are
named acceptance checks, not counts of individual `assert` calls (that count is unavailable).
Confirm zero failed checks and no skipped named checks, and inspect the failing child records too.
For the interrupted fixture, confirm saved evidence still exists and is nonempty. Missing summary
after the hard-kill control is expected partial evidence; the parent retains its signal and stdout.

## Demonstrated on 2026-10-12

Baseline: clean `d7cde6a59a7d847407b7b478b78269a97201f24f`. Current comparison: the same
revision plus the #304 prose additions, followed by the ticket commit. Tooling: Node `v26.8.1`,
pnpm `9.15.0`, macOS, local time zone Australia/Sydney. Fixture dates use the real clock;
no browser context, provider credentials or application build is involved. The probes use identical
runner/fixture source on both trees; verify that with:

```bash
git diff --exit-code d7cde6a -- apps/web/tests/e2e apps/web/tests/cli-e2e/legacy-runner.e2e.mjs apps/web/tests/cli-e2e/report-interrupted.e2e.mjs
```

Both baseline and current controls passed all 8 runner and 7 report checks, with zero failed or
skipped named checks. The timeout/survivor child exited 1 with a retained `TIME` followed by `ok`;
the resistant child exited 1, EACCES exited 2, and standalone `e-pass` controls exited 0. The hard-kill
child retained SIGKILL and partial stdout. Saved interrupted records remained incomplete, and saved
failed results stayed failed while report reading exited 0. The later passing repeat member remained
visible alongside the earlier interruption. These observations establish runner/report controls only.

The session log names the baseline/current raw evidence directories and capture files. Keep those
ignored directories for local inspection; they are not included in a Git checkout or guaranteed by
this prose. Before removing a worktree, preserve required evidence through the task owner's artifact
handoff. Retained output can contain local paths; inspect it before sharing.
