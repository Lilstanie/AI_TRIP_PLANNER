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
