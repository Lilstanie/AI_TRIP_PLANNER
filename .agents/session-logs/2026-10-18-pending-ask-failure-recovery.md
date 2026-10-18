---
date: 2026-10-18
author: Codex
branch: fix/pending-ask-failure-recovery
pr: https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/448
area: apps/web, docs
contract-impact: none
---

# Preserve pending questions and answers through failures and reloads

## What changed

- `apps/web/lib/workspace/session.ts` retains pending asks while a reply is in flight and clears them after a successful reply.
- `apps/web/components/chat/QuestionComposer.tsx` persists question selection and drafts in the saved session.
- `apps/web/tests/e2e/pending-ask-refresh.e2e.mjs` verifies reload, failed submission, retry and successful completion at mobile and desktop widths.
- `docs/workspace-ui.md` and `docs/workspace-ui.zh.md` describe the recovery behavior.

## Why

Issue #422's acceptance criteria require an unanswered question, options, selection, and submit/skip actions to remain available after reload and failed submission.

## Validation

- `pnpm --filter @trip/web test` — passed, 57 files and 632 tests.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm --filter @trip/web lint` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs` — passed.
- `pnpm exec prettier --check <changed files>` and `git diff --check` — passed.
- `CHANNEL=chrome pnpm --filter @trip/web e2e pending-ask-refresh` — passed all 21 assertions at 375px and 1440px; evidence is under `apps/web/output/e2e/runner/`.
- Updated CLI acceptance discovery and fixture coverage for the newly registered journey after CI exposed stale expected journey lists.
- Initial CI failed only in the CLI acceptance fixtures because they expected two registered journeys; both fixture and discovery expectations now include `pending-ask-refresh`.
- The next CI run passed discovery, named-journey, and `--all` success cases, then exposed one remaining failure-aggregation expectation with two results; updated the failure and event-order expectations for all three journeys.
- Local rerun of `local-cli-collections.e2e.mjs` could not reach fixture assertions because this checkout lacks Playwright's bundled Chromium; CI installs the browser and will verify the updated full collection.
- The pre-fix E2E run failed the selected-answer restoration assertion at both widths; its red artifact is retained beside the passing run.
- The runner first could not launch its absent bundled Chromium; one intermediate run also exposed a persistence timing race. Both failed attempts are retained under `apps/web/output/e2e/runner/`.

## Notes for the next person

- No known gaps. The E2E evidence directory is removed by `pnpm clean:output` after it is recorded in the PR body.
