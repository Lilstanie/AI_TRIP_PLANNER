---
date: 2026-10-11
author: Codex
branch: feature/local-test-cli-294
pr: none
area: apps/web, docs
contract-impact: none
---

# Add an isolated local E2E CLI invocation

## What changed

- Added `e2e run` with a production default, explicit development mode, JSON/human statuses, and per-invocation summary and browser evidence.
- Preserved raw E2E syntax through the extracted legacy runner; kept the Agent Lab fixture assertions intact.
- Added owned-process cleanup, env isolation, unique build/temporary TypeScript config paths, and loopback lifecycle checks.
- Added paired CLI guidance and an implemented Agent Note.

## Why

The first supported fixture run needs to be reproducible without inherited URLs or known credentials activating integrations. The TypeScript config copy prevents Next from modifying shared config as it discovers a unique build directory.

## Validation

- `node apps/web/tests/cli-e2e/local-test-cli.e2e.mjs` — passed; covered unsupported, production pass, app-file synthetic env, timeout, production-build interruption, journey interruption, server-spawn failure, raw syntax, unrelated sentinels, and shared tsconfig preservation.
- `pnpm --silent --filter @trip/web e2e run agent-lab-single-agent --json` with the Playwright link temporarily absent — emitted `outcome: blocked`, nonzero exit, and a summary.
- `node --input-type=module -e '<EACCES probe>'` — owned Next launcher produced `startup_failed`; its original mode was restored.
- `pnpm exec prettier --write apps/web/tests/cli-e2e/local-test-cli.e2e.mjs .agents/session-logs/2026-10-11-local-test-cli.md` — passed.
- `node --check apps/web/tests/e2e/local-cli.mjs` and `node --check apps/web/tests/cli-e2e/local-test-cli.e2e.mjs` — passed.
- `git diff --check` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm verify:e2e-selectors`, `pnpm format:check-changed`, and scoped `pnpm exec prettier --check ...` — passed.

## Notes for the next person

- The deny list covers current repository integrations only; this is not an arbitrary network egress firewall.
- The supported command boundary is one named fixture journey. Tickets #295–299 can extend `runLocalCli` dispatch and the `results` summary.
