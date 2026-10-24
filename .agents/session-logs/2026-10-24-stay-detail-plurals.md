---
date: 2026-10-24
author: Claude (project thread for Joey)
branch: fix/shared-describe-plurals
pr: none
area: packages/shared
contract-impact: packages/shared
---

# Count rooms and nights in words in the shared stay detail

## What changed

- `packages/shared/src/describe.ts`: `describeStayChoice` writes "1 room × 3 nights" instead of
  "1 room(s) × 3 night(s)".
- `packages/orchestrator/src/agent-lab/{paris-family,tokyo-kyoto}.ts` and
  `apps/web/tests/e2e/agent-lab-benchmarks.e2e.mjs`: fixture stays use the same wording.
- `apps/web/tests/e2e/specialist-summary-plurals.{e2e.mjs,failures.md}`: the stream check now
  rejects any "(s)" and expects "1 room × 3 nights × ".
- Agent Note `feature/2026-10-24-stay-detail-plurals.md`; `docs/workspace-ui` (en and zh).

## Why

This was the last "(s)" placeholder in the English plan stream. #626 left it alone because the file is
a protected shared contract, and Joey approved the change on 2026-10-24.

## Validation

- `specialist-summary-plurals` E2E, mock: 7/10 before the fix, 10/10 after.
- `agent-lab-benchmarks` E2E: ok. `pnpm typecheck`, `pnpm test`, `pnpm lint`: all 6 packages pass.
