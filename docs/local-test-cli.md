# Local E2E CLI

English | [中文](local-test-cli.zh.md)

The E2E entry point has an isolated `run` command. With no journey names, it runs curated smoke; name
one or more supported journeys to choose them, or use `--all` for every supported local journey:

```bash
pnpm --filter @trip/web e2e run
pnpm --filter @trip/web e2e run agent-lab-single-agent agent-lab-replay
pnpm --filter @trip/web e2e run --all
pnpm --filter @trip/web e2e run agent-lab-single-agent --dev
pnpm --silent --filter @trip/web e2e run --all --json
```

The command binds its own Next server to `127.0.0.1` on a free loopback port. Readiness requires the
spawned Next process to report that it is ready and the server to answer HTTP; another service on the
port cannot satisfy the check. It uses a production build and server by default; `--dev` selects Next
development mode. An inherited `BASE_URL` is ignored. A fresh invocation
directory under `output/e2e/local-test-cli/` contains `summary.json`, build/server/journey logs and each
journey's screenshots, API streams and artifacts. The summary records selection mode, exact requested
journeys, one outcome per journey, reproduction command, server mode, retained build directory and evidence
paths. A multi-journey run uses a separate evidence subdirectory for each journey. Each run gets its own
invocation directory.

JSON mode writes one JSON object to standard output; child output goes to the invocation's log files.
Use pnpm's `--silent` option so pnpm's own package banner does not precede that object. The object
includes `outcome`, `requested`, per-journey `results`, `summaryFile` and `evidenceDirectory`.
`passed` exits zero. `unsupported`, `blocked`, `failed`, `startup_failed`, `timed_out` and
`interrupted` exit nonzero.

The local process receives only basic runtime environment settings. Known model, provider, database,
KV and authentication credentials are blanked for both build and runtime, including when Next loads
app-local dotenv files; mock data is enabled and Agent Lab live runs are disabled. Next uses an
invocation-specific temporary TypeScript config so its build cannot append the temporary output
directory to the shared `apps/web/tsconfig.json`. The build directory is retained and recorded as an
owned resource. This protects the integrations currently used by the repository. It is not a general
network egress firewall, and new credential names must be added to the CLI's deny list before their
integration is covered.

The supported journeys are `agent-lab-single-agent` and `agent-lab-replay`. Smoke runs only
`agent-lab-single-agent`: a complete desktop and phone browser run of the registered Agent Lab fixture.
Its assertions cover fixture provenance, the completed API artifact, the rendered plan, keyboard access,
workspace storage preservation and browser errors. `agent-lab-replay` runs the tight-budget fixture and
checks artifact download, replay, comparison, invalid artifact handling, and the resulting UI and status.
`agent-lab-live-gate` remains unsupported because it needs two additional servers and skips internally
when they are unavailable. Other journeys remain unsupported until their complete fixture path and server
requirements are verified. An unsupported explicit selection and any failed, timed-out or blocked journey
make the collection nonzero; a passing journey cannot erase another outcome. The legacy raw form remains available:

```bash
pnpm --filter @trip/web e2e agent-lab-single-agent
pnpm --filter @trip/web e2e agent-lab-replay
```

Raw scripts retain their existing environment and server-reuse behavior. Use the isolated `run`
command when the fixture-only environment and per-invocation evidence are required.

## Repeat runs

Repeat a supported selection serially with a positive whole number:

```bash
pnpm --filter @trip/web e2e run agent-lab-single-agent --repeat 3
pnpm --filter @trip/web e2e run agent-lab-single-agent --dev --repeat 3
pnpm --silent --filter @trip/web e2e run agent-lab-single-agent --repeat 3 --json
```

Every attempt starts a fresh local CLI invocation with its own build, server, browser process, fixture
execution and evidence directory. The repeat summary records the requested count and each started
attempt's outcome, reproduction command, child summary and evidence paths. A failed, blocked,
unsupported, timed-out or interrupted attempt keeps the repeat outcome nonzero even when a later
attempt passes. An attempt counts as passed only when both its saved run summary and child process
exit report success. The requested number of attempts runs serially; this is not an automatic retry.
Invalid counts are rejected before an invocation starts. If the repeat command is interrupted,
completed summaries and available evidence remain, the active child is asked to clean up, and the
summary reports how many requested attempts did not start.

JSON output includes `requestedRepeatCount`, `attempts` and `results` alongside the usual summary
paths. Without `--json`, the command prints a readable outcome and summary path. Each child invocation
still writes its own summary and evidence under `output/e2e/local-test-cli/`.

## Check readiness and discover support

Run the offline doctor and list commands from the same entry point:

```bash
pnpm --filter @trip/web e2e doctor
pnpm --silent --filter @trip/web e2e doctor --json
pnpm --filter @trip/web e2e list
pnpm --silent --filter @trip/web e2e list --json
```

If pnpm itself is unavailable, run `node apps/web/tests/e2e/run.mjs doctor --json` from the repository
root to see the blocked package-manager check.

`doctor` checks the Node.js and pinned pnpm versions, the web Next.js executable, Playwright and its
Chromium executable, the required `apps/web/tsconfig.json` shape (`include` is a string array), and
whether app dotenv files are present. It never starts the application or a
test server, contacts a provider, or reads or changes dotenv contents. Provider credentials are not
required for the local fixture profile. Missing required tools are `blocked`, include a remediation,
and return nonzero. JSON output is one object with `schemaVersion`, `command`, `outcome` and `checks`;
each check has an id, status and summary, with remediation when blocked.

`list` shows every raw E2E script with its support status, known prerequisites and an exclusion reason.
Its JSON object includes `supported`, the unsupported count and a `scripts` array. Only
`agent-lab-single-agent` and `agent-lab-replay` are supported. Replay covers a tight-budget fixture,
artifact download and replay, comparisons, invalid artifacts, and resulting UI and status. Smoke runs
only the single-agent journey. `leg-mode-choice` remains excluded because one
model-dependent scenario can skip while the script still exits successfully. `agent-lab-live-gate`
and `map-provider-http` need multiple servers. `plan-quality` and `conversation-scope` default to live
data and need `DEEPSEEK_API_KEY`. Scripts that have not been audited for complete fixture-only
execution and isolated state remain unsupported, with unverified prerequisites called out. A listed
script is not a claim that its assertions passed.

## Inspect a saved invocation

Read one completed local run or repeat by its invocation ID or saved `summaryFile` path:

```bash
pnpm --filter @trip/web e2e report <invocation-id>
pnpm --silent --filter @trip/web e2e report <summaryFile> --json
```

The report reads the saved record and checks whether its evidence directories are still present. It
does not rerun a check, start a server or modify the summary or evidence. JSON `reportOutcome: "reported"`
means the report was read successfully; `recordedOutcome` is the test result. A recorded failure is
still a successfully read report and does not make the report command fail. `recordStatus` is
`incomplete` when a check is still running, the summary is partial, its results do not match every
requested journey exactly once, or its evidence is missing.

Repeat reports retain every attempt in order, including failures before a later pass. Missing child
summaries, interrupted attempts and missing evidence are marked incomplete instead of being presented
as passing coverage. Unknown IDs, malformed summaries and paths outside the saved local CLI records
return nonzero; JSON errors do not include saved file contents.

## Clean up an invocation

Remove the temporary resources owned by one completed invocation while keeping its report and
diagnostic evidence:

```bash
pnpm --filter @trip/web e2e cleanup <invocation-id>
pnpm --silent --filter @trip/web e2e cleanup <invocation-id> --json
```

The command derives the only removable paths from the invocation ID, then checks the saved summary,
separate ownership record, resource type and filesystem identity. For a repeated run, it also checks
that the parent record links to each child run's own verified summary and ownership record. It removes
a resource only when those records agree and the resource still has the recorded identity. Unknown
IDs and missing, forged, stale, replaced or symlinked resources are reported as `not_found`,
`invalid` or `blocked`; they are left untouched. Running cleanup again on an already-cleaned
invocation succeeds with `already_clean`.

Cleanup retains `summary.json`, ownership metadata, logs, screenshots, traces and other evidence. It
does not terminate processes, delete arbitrary paths, or remove another invocation's files. A
partially written invocation without a verifiable ownership record is not cleanable by this command.
The records provide an integrity and consistency check, not cryptographic authentication against
someone who can rewrite both records and create matching resources.
The JSON result reports the outcome, each resource's action, any removed paths and the retained
summary path.
