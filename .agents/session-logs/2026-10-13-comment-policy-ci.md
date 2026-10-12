---
date: 2026-10-13
author: Codex
branch: feature/comment-policy-ci
pr: none
area: testing, .github, docs
contract-impact: none
---

# Run the added-comment gate on PRs and main pushes

## What changed

- Added `.github/workflows/comment-policy.yml` and a clean-head adapter for the existing checker.
- Added exact exception assets and rename-aware comparison, preserving the local checker interface.
- Added subprocess Git-fixture E2E under `apps/web/tests/ci/` outside the CLI acceptance inventory.
- Synchronized development EN/ZH, review/pre-push guidance and the owning process decisions.

## Why

The local-only mechanical gate could be skipped. The user confirmed PR/main enforcement with exact
reviewed exceptions, an independent PR and a stop before merge. Required-check settings stay separate.

## Validation

- Failure inventory written before implementation; missing adapter/report reproduced as red.
- `node apps/web/tests/ci/comment-policy.e2e.mjs`: 18 subprocess cases passed.
- `node apps/web/tests/cli-e2e/review-comment-policy.e2e.mjs`: 23 existing cases passed.
- Actionlint and `git diff --check` passed; scoped added-comment checker: zero violations.
- Translation-pair check: 26 pairs passed. Protected-file checks passed.
- Docs guard caught invalid asset placement; moved the exception JSON into skill assets.

## Notes for the next person

Complete final guards, Standards/Spec review and current-SHA CI before delivery; stop before merge.
The read-only test-cost audit is separate and authorizes no test removal or main-full policy change.
Original main's unrelated dirty and untracked files remain untouched.
