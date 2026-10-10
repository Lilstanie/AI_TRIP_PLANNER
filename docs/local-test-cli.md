# Local E2E CLI

English | [中文](local-test-cli.zh.md)

The E2E entry point has an isolated `run` command for the first supported local fixture journey:

```bash
pnpm --filter @trip/web e2e run agent-lab-single-agent
pnpm --filter @trip/web e2e run agent-lab-single-agent --dev
pnpm --silent --filter @trip/web e2e run agent-lab-single-agent --json
```

The command starts its own server on a free loopback port. It uses a production build and server by
default; `--dev` selects Next development mode. An inherited `BASE_URL` is ignored. A fresh invocation
directory under `output/e2e/local-test-cli/` contains `summary.json`, build/server/journey logs and the
journey's screenshots, API streams and artifacts. The summary records the requested script, final
status, reproduction command, server mode, retained build directory and evidence paths. Each run gets
its own directory.

JSON mode writes one JSON object to standard output; child output goes to the invocation's log files.
Use pnpm's `--silent` option so pnpm's own package banner does not precede that object. The object
includes `outcome`, `requested`, per-script `results`, `summaryFile` and `evidenceDirectory`.
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

The initial supported journey is `agent-lab-single-agent`, a complete desktop and phone browser run
of the registered Agent Lab fixture. Its assertions cover fixture provenance, the completed API
artifact, the rendered plan, keyboard access, workspace storage preservation and browser errors.
The legacy raw form remains available:

```bash
pnpm --filter @trip/web e2e agent-lab-single-agent
```

Raw scripts retain their existing environment and server-reuse behavior. Use the isolated `run`
command when the fixture-only environment and per-invocation evidence are required.
