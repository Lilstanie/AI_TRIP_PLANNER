---
date: 2026-10-14
author: Codex
branch: main
pr: none
area: apps/web, docs, workflow
contract-impact: none
---

# Automatically clean completed local E2E builds

## What changed

- `apps/web/tests/e2e/local-cli.mjs` now cleans invocation-owned build directories after saving the result; report and evidence files remain.
- `apps/web/tests/e2e/cleanup-cli.mjs` verifies filesystem identity across device-number changes caused by workspace remounts.
- Updated cleanup acceptance expectations and both local CLI references; removed the obsolete pull request template and its skill-maintenance path.
- Cleaned 40 legacy build directories through the ownership-aware cleanup CLI; retained invocation reports and evidence.

## Why

- Completed invocations previously retained their build directories. Cleanup also rejected valid ownership records after a remount changed device numbers, so the directories accumulated.

## Validation

- Ownership-aware `pnpm --silent --filter @trip/web e2e cleanup <id> --json`: 39 remaining directories cleaned; no failures. The first directory was separately cleaned before the batch.
- `pnpm exec prettier --write` on changed implementation, acceptance and reference files: formatted correctly.
- `git diff --check`: passed.
- Read-only inventory: 0 local E2E build directories, 0 temporary configs, 109 invocation directories and summaries retained.
- E2E acceptance was not run.

## Notes for the next person

- Reports and evidence remain under `output/e2e/local-test-cli/`; cleanup records remain available for later inspection.
- The existing unrelated Android change and pre-existing untracked files were left untouched.
