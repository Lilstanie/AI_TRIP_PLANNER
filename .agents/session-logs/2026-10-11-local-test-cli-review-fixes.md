---
date: 2026-10-11
author: Codex
branch: feature/local-test-cli-review-fixes
pr: none
area: apps/web, docs, agent-notes
contract-impact: none
---

# Close final review findings for the local E2E CLI

## What changed

- Hardened owned-server readiness and loopback binding in `apps/web/tests/e2e/local-cli.mjs`.
- Added doctor `tsconfig` shape checks, exact report coverage checks, and repeat child-exit validation.
- Added CLI E2E regressions and updated paired English/Chinese command docs and the implemented note.

## Why

The final review found gaps where a foreign listener, malformed config, missing result coverage, or nonzero child exit could be misreported. Current supported journeys are single-agent and replay.

## Validation

- `node apps/web/tests/cli-e2e/discovery.e2e.mjs` — red before doctor fix (missing `tsconfig` incorrectly passed); green after fix.
- `node apps/web/tests/cli-e2e/report-cli.mjs` — red before coverage fix; green after, including missing, duplicate, and unrequested results.
- `node apps/web/tests/cli-e2e/local-test-cli.e2e.mjs` — green; proved loopback listener, foreign responder rejection, owned startup failure, compatibility, interruption, and retained evidence.
- `node apps/web/tests/cli-e2e/local-test-cli-repeat.e2e.mjs` — green after passing the child process exit code into outcome normalization.
- `pnpm --silent --filter @trip/web e2e run --all --dev --repeat 2 --json` — not completed. An earlier run exposed the parent repeat normalization regression and a replay file-chooser timeout; after correction, the rerun stopped during attempt 2 with `ENOSPC` while writing `attempt-2.log`. Do not treat the combined chain as passing.

## Notes for the next person

The repeat E2E covers a normal successful child and an interrupted child, but has no deterministic public seam for a passing saved summary paired with a nonzero process exit. That abnormal pair is guarded in production code but was not reproduced independently. Further browser/build validation was deferred after disk exhaustion; preserve the retained output under `apps/web/output/e2e/local-test-cli/`.
