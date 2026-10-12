---
date: 2026-10-12
author: Codex
branch: feature/cli-acceptance-integration
pr: 318
area: apps/web, docs, .github
contract-impact: none
---

# Integrate selected CLI acceptance and stable results (#317)

## What changed

- `.github/workflows/ci.yml`: builtin plan, up to three independent workers, stable aggregate,
  JSON plan transfer and unique seven-day failure evidence. Existing check/protected jobs unchanged.
- `ci-result.mjs`, shared validation in `runner-plan.mjs`, and subprocess `ci-integration.e2e.mjs`:
  validate explicit skip, exact planned receipts, selected execution and retained failure evidence.
- Development EN/ZH pair, its review record, pre-push/E2E maintenance skills and
  [CI decision](../notes/implemented/process/2026-10-12-cli-acceptance-ci.md); cross-link the partly
  replaced performance note while preserving its serial-within-checkout and unrelated decisions.

## Why

Docs-only changes avoid worker setup; isolated workers preserve mutable fixture ownership.
Dependent deliveries require combined integration before merge; main evidence belongs to its own SHA.

## Validation

- Failure inventory written before production edits: external `cli-acceptance-ci/ci-failures.md`.
- Four subprocess red/green cycles (exit 1 then 0): docs-skip, selected-workers, invalid-skip and
  aggregate-failures. Commands and artifacts: external `cli-acceptance-ci/ci-red-green.md`.
- `node apps/web/tests/cli-e2e/selection.e2e.mjs`: 9 scenarios passed; `output/e2e/selection/run-R9NUSt/summary.json`.
- `node apps/web/tests/cli-e2e/runner-plan.e2e.mjs`: 6 passed; `output/e2e/runner-plan-vjjCxM/summary.json`.
- `node apps/web/tests/cli-e2e/ci-integration.e2e.mjs`: 7 passed; `output/e2e/ci-integration-uIA1pj/summary.json`.
- Real committed-tree push plan at `f902567`: full 13 scripts/3 nonempty shards, including integration
  acceptance; public matrix command passed. Evidence: `output/e2e/cli-plan/main-final.json`.
- External actionlint 1.7.12, verify-docs, verify-e2e-selectors, branch-name, scoped added-comment,
  scoped Prettier, changed-format against origin/main, protected-files against origin/main and
  git diff --check passed. Only the development pair was reviewed/recorded after final formatting;
  check-pairs passed for 26 pairs. Frozen history and other root configuration untouched.
- `pnpm install --frozen-lockfile` passed in this worktree; lockfile unchanged.
- Merged latest local integration tip `cf35a29`: already up to date; source commit `f902567`.

## Notes for the next person

Local Node 26.8.1/macOS subprocess evidence does not prove Linux/Node 22 matrix scheduling or uploads.
No full browser suite was rerun locally. Parent owns two-axis review, final PR #318 CI and merge;
no agents, push, external issue/PR edits, other worktree edits or main merge were performed.
