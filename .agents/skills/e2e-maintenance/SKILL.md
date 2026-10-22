---
name: e2e-maintenance
description: Diagnose and repair E2E tests in AI_TRIP_PLANNER with equivalent Git reproductions, failure controls and retained evidence. Use when a test hangs, skips assertions, reports false success, flakes, or fails because of fixtures, browser context or environment assumptions.
---

# Maintain an E2E check

Use this workflow when the test or its execution is in doubt. Product correctness review stays with
[review-trip-planner](../review-trip-planner/SKILL.md); visible behavior evidence stays with
[ui-verification](../ui-verification/SKILL.md). Select focused guards with
[pre-push-checks](../pre-push-checks/SKILL.md). Browser implementation techniques are in
[playwright-best-practices](../playwright-best-practices/SKILL.md).

The [testing approach](../../../docs/development.md#testing-approach) owns test placement and policy.
The [local E2E CLI](../../../docs/local-test-cli.md) owns command support, isolation and report
semantics. Keep the current runner; do not install a second framework to diagnose it.
For collection-selection maintenance, the local CLI reference distinguishes retained browser controls
from copied-CLI subprocess fixtures. Preserve that evidence boundary when reducing repeated setup.

## 1. State the failure before changing the check

Read the originating requirement, script header, assertions, runner and relevant accepted Agent Notes.
Inspect commits affecting those files and reuse coverage already present. Write a failure inventory
before any isolated implementation: trigger, observable public boundary, expected result and the
evidence that would distinguish failure from an environment problem. Derive each repair from that
inventory; never add unit tests after implementation.

Include the suspected defect and ways the check could hide it: an unentered branch, missing fixture,
skip, caught assertion, early return, successful child exit despite failed summary, timeout, missing
artifact, or later pass overwriting a failure. Agree new behavioral seams before writing checks;
reuse already confirmed seams without asking again.

Read [known failures](../../../docs/e2e-known-failures.md) as dated evidence. A listed failure still
needs an equivalent reproduction before it can explain this run.

## 2. Reproduce the Git baseline and current branch equivalently

Record exact baseline and current SHAs, worktree status and uncommitted diff. Use a dedicated
baseline checkout when authorized; never reset a shared or dirty checkout. Run the smallest existing
public probe or named journey on both revisions. Match Node/pnpm/browser versions, dependency state,
server mode, fixture version, viewport/context, locale, clock/time zone, credentials being absent and
timeout limits. Give every attempt separate evidence. Run serially if fixtures replace dependency
entrypoints; do not share generated Next types or build output between competing commands.

Compare commands, process results and raw observations, not just green console lines. If the older
revision lacks the command, use a common existing boundary or report the comparison unavailable.
If both fail identically, retain both reproductions; if only current fails, investigate the changed
boundary. If conditions differ, classify the cause as unresolved until the difference is controlled.
For a prose-only change, record a tree comparison proving the exercised runner/fixtures are unchanged;
do not imply that this establishes browser or product coverage.

For CLI selection and scheduling, exercise the public selector, runner and CI result commands in
copied temporary fixtures. `node apps/web/tests/cli-e2e/ci-integration.e2e.mjs` checks actual selected
scripts across isolated shards, explicit docs skip without children, aggregate rejection of missing,
failed or cancelled work, malformed plans and retained failure/interruption evidence. Keep its
`output/e2e/ci-integration-<run>/` JSON and copied fixtures. Existing selector and runner acceptance own
Git change edge cases, no-argument compatibility and descendant termination. Do not replace these
with source/YAML string assertions.

[CI acceptance](../../../docs/development.md#cli-acceptance-in-ci) uses separate checkout and dependency
trees, at most three workers and serial execution inside each. A successful docs skip establishes no
executed acceptance coverage. Check the explicit plan, all worker receipts and stable aggregate on
the exact integration PR SHA; main's full result covers only its own post-merge SHA. Local fixtures
and actionlint do not establish real GitHub scheduling or artifact availability.

Worker evidence is uploaded as `evidence.tar.gz`; extract it before inspecting retained reports and
fixtures. `node apps/web/tests/cli-e2e/ci-integration.e2e.mjs package-unsafe-evidence` checks exact raw
filename/content recovery, hidden metadata and archive scope; `package-failure-publication` checks
partial-tree evidence and failure cleanup. Preserve adversarial filenames in fixtures instead of
renaming or excluding them to satisfy upload restrictions. Packaging/upload failure remains a failed
worker and aggregate even when acceptance itself passed.

## 3. Prove the check actually ran and can fail

- Inspect expected versus observed assertions, passed/failed/skipped counts, named scenarios,
  child exit codes/signals, runner exit and saved summaries. Count skipped branches as unverified.
  A zero exit with every scenario skipped establishes no acceptance coverage.
- Trace assertions to the public result required by the spec. Check catch blocks, optional-key gates
  and early returns. Report assertion counts separately from runner scenario counts; if the script
  does not expose an assertion count, say unavailable rather than inferring it from scenario totals.
- Run a successful control and a deliberate failure through the same existing runner, using an
  existing deterministic fixture or fault mode. State the expected exit and summary before running.
  The failure must be observable at that boundary; a typo rejected before the journey starts does
  not prove a journey assertion can fail. Avoid changing production code to manufacture the control.
- Keep ordered attempts. A later pass cannot erase an earlier failure, timeout or interruption.
  Repeat is measurement, not a retry policy. Check that saved evidence exists and is nonempty.
- For saved CLI reports, distinguish successful reading from successful testing: `reportOutcome`
  describes the read, `recordedOutcome` describes the run, and `recordStatus` describes completeness.
  A report can exit zero while correctly retaining a failed run. Missing evidence or interrupted
  coverage cannot become a pass.

For a lightweight worked example using existing deterministic fixtures, see
[runner and report controls](references/deterministic-controls.md).

## 4. Control the environment at its external boundaries

| Suspect                         | What to reproduce and retain                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixture/detail mismatch         | Follow search IDs into details, photos and routes. Supply consistent details for stand-in IDs through existing fixtures or external request interception; record unexpected 404s and browser errors. Preserve valid empty results separately from provider outages.                                                                                                                                                                               |
| Dates and time zones            | Record the instant, browser/server zones and destination zone independently. Exercise local midnight, month/year rollover and DST boundaries where relevant; avoid a fixed date that silently expires. Control time at the system boundary and retain the literal expected date.                                                                                                                                                                  |
| Chromium context/installability | Record executable/channel, full Chromium versus headless shell, version, fresh or persistent context, origin and viewport. Check the script's installability assumptions; a fresh context or different binary may change install prompts. Browser simulation does not prove physical-device behavior.                                                                                                                                             |
| Development overlays            | Record `next dev` versus production and the actual obstructing element. A dev error overlay covering a control needs its error captured; compare production when the script requires it rather than hiding the overlay to force a pass.                                                                                                                                                                                                           |
| Service worker                  | Installability requires production here. Record registration/control state, caches and origin; await the required lifecycle state. Reset only the owned test context/cache, preserving user browser profiles and other runs.                                                                                                                                                                                                                      |
| External services               | Prefer the registered fixture profile with known credentials blanked and model/live gates disabled. Stub only external boundaries, time or randomness, not internal collaborators. The raw runner inherits environment and `BASE_URL`; it does not provide the isolated CLI's credential boundary. The isolated CLI is not a network firewall: intercept relevant SDK/tile/provider requests and report any remaining live dependency explicitly. |

Use offline `doctor` and `list` to inspect local CLI prerequisites and supported journeys. A listed
script is not executed coverage. Follow the script header for raw scripts needing additional servers
or credentials; never spend live provider quota to validate maintenance prose.

## 5. Bound execution and preserve ownership

Choose a finite deadline before starting. The raw runner uses `E2E_SCRIPT_TIMEOUT_MS`; the isolated
CLI uses `--timeout-ms` for a journey. Record build/readiness and outer invocation deadlines too:
a journey limit alone does not bound setup. Use the runner's signal handling and allow its termination
grace before escalation. Capture the exit signal, timeout marker and partial logs even when no final
summary can be written; mark absent summaries incomplete.

On interruption, stop only the invocation and process groups it spawned. Record PID/group identity
at launch and verify ownership and current identity before manual escalation; never kill all Node,
Next or Chromium processes or infer ownership from a port. Cancel stale timeout escalation when its
original child exits so it cannot reach a later child. Do not reuse another run's server/build slot.
Preserve unrelated worktrees, servers, locks, browser profiles and dotenv files.

Keep partial NDJSON, screenshots, traces, child logs, saved summaries and ownership metadata before
cleanup. Raw summaries and evidence can be incomplete after a hard kill. A finished run removes its
owned build directory and temporary config itself, and `passed` requires that cleanup to succeed. The
isolated CLI's [`cleanup`](../../../docs/local-test-cli.md#clean-up-an-invocation) is for an
interrupted or blocked run: it validates recorded resource identity and retains diagnostics; it does
not terminate live processes.
Use it only after the owned process has stopped, and report blocked cleanup without deleting paths
manually. Do not remove retained output merely because a later attempt passed. Local output goes
only through `pnpm clean:output`, once the pull request's Evidence section quotes the results
(AGENTS.md delivery step 5), and never while an owned run or server is still active.

## 6. Deliver a reproducible maintenance record

Record these in a new session log and the pull request's Evidence section. `pnpm clean:output`
later deletes the ignored output directories, so quote the decisive results instead of relying on a
local path:

- Requirement/failure inventory and public boundary; baseline/current SHAs and dirty-tree state.
- Exact commands, working directory, tool versions, server mode, fixture identity and non-sensitive
  environment assumptions. Record credential presence/absence, never values or full environment dumps.
- Each attempt's exit/signal, assertion and skip counts (or explicitly unavailable), scenario totals,
  summary outcome/completeness and the observation made by each control.
- Paths to retained raw logs, summaries, NDJSON, artifacts, screenshots/traces where applicable;
  explain unavailable evidence. Include reproduction commands for failures as well as passes.
- Classification: product regression, test defect, environment prerequisite, known baseline failure,
  or unresolved. State what was repaired and what remains unverified.

When a known-failure entry needs updating, preserve its source (script/commit/issue), exact recipe,
baseline revision, mode/fixture/environment assumptions, observed failure and last-checked date/state.
A later pass adds dated evidence; it does not delete the earlier failure's reproduction history.
Synchronize the English/Chinese record through its owner. Add lasting decisions with
[agent-notes](../agent-notes/SKILL.md) and session history with
[session-log](../session-log/SKILL.md); report any required edits outside your authorized scope.

## Traps this app has already hit

Each of these cost a rerun once. Check for them before reading a failure as a product bug:

- Playwright treats an `aria-disabled="true"` control as not actionable and waits. To prove that
  activating it does nothing, click with `{ force: true }`.
- A trip that saved a budget keeps that budget's currency as its display currency. Test another
  currency in a fresh browser context, not after an AUD trip in the same one.
- On phone, "New trip" opens the trip-details sheet over the tab bar; press Escape before tapping a
  tab.
- Stubbing `/api/places` with an empty list shows the "could not be shown on the map" card, not the
  partial-places notice. Leave places unstubbed to reach the partial notice.
- Phone Mine lists trips as `.trip-card__title` cards under a Trips tab, not as
  `.history-item--trip` rows.
- `getByText(..., { exact: true })` on a search-result message also matches the sr-only
  `role="status"` region that repeats it, which throws in strict mode. Read the status by role, or
  scope the visible line by its class.
