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

The command starts its own server on a free loopback port. It uses a production build and server by
default; `--dev` selects Next development mode. An inherited `BASE_URL` is ignored. A fresh invocation
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
attempt passes. The requested number of attempts runs serially; this is not an automatic retry.
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
Chromium executable, and whether app dotenv files are present. It never starts the application or a
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
