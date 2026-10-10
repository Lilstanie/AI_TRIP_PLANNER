---
date: 2026-10-11
author: Codex
branch: feature/local-test-cli-298
pr: none
area: apps/web, docs
contract-impact: none
---

# Add reports for saved local E2E invocations

## What changed

- Added `e2e report` for saved ordinary and repeat invocation summaries.
- Added public CLI subprocess acceptance coverage under `apps/web/tests/cli-e2e/`.
- Documented report behavior in English and Chinese.

## Why

- Reporting separates successful inspection from the recorded test outcome, so saved failures remain visible without making inspection fail.
- Missing evidence and interrupted repeat attempts are marked incomplete; reports only read saved metadata and evidence state.

## Validation

- `node apps/web/tests/cli-e2e/report-cli.mjs` — passed 27 checks, including a real local fixture run, failed/repeat/interrupted records, path rejection and unchanged evidence.
- `node apps/web/tests/e2e/run.mjs report <invocation-id>` — human-readable report of the saved passing fixture succeeded.
- `pnpm verify:pairs` — passed; checked 26 documentation pairs.
- `pnpm verify:docs` — passed.
- `pnpm verify:protected` — passed.
- `pnpm exec prettier --check ...` — passed for all changed source, docs and pair-record files.
- `git diff --check` — passed.

## Notes for the next person

- Reports operate on local saved records only and do not validate live providers or rerun scenarios.
