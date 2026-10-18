---
date: 2026-10-18
author: Codex
branch: fix/review-triage-oct17
pr: 438
area: apps/web, packages/orchestrator, docs
contract-impact: packages/shared
---

# Close remaining October triage review gaps

## What changed

- Fixed Chinese “不需要住宿” matching and covered it through the mock chat API.
- Grounded day-removal claims only when the requested day existed before and is absent afterward; reproduced the false claim red, then the regression passed.
- Limited unpriced-cost cautions to plans at budget or within 5% headroom.
- Added mobile touch-area guidance and split oversized chat plan-change tests.
- Added per-run latency and strategy medians to the agent-lab fixture report.
- Extracted chat grounding and phone timeline measurements into focused modules.

## Why

These changes close review gaps in the October triage batch. A separate full-repository audit found server-side candidates that need their own triage.

## Validation

- Orchestrator: 23 test files, 275 tests passed; lint and typecheck passed.
- Web build, typecheck, and lint passed.
- Mock browser E2Es passed: no-accommodation, trip-ui-triage, timeline (132s), and agent-lab-benchmark. Artifacts: `output/e2e/runner/2026-10-17T14-24-06-684Z.json`, `2026-10-17T14-31-06-717Z.json`, `2026-10-17T14-50-54-525Z.json`, and `2026-10-17T14-39-38-364Z.json`. The final benchmark passed in 125 seconds; its earlier timeout artifact is retained. The first timeline run exposed unmocked place-detail 404s; the test now mocks them.
- Docs, protected files, paired docs (27), E2E selectors and artifacts (77), changed-file formatting, diff whitespace, and changed-source comment checks passed.
- Full monorepo `pnpm test` was not rerun; an earlier run had 15 stale web assertions failing (617/632).

## Notes for the next person

- PR #438 remains a draft and is unmerged; merge only with explicit owner instruction.
- The audit's auth, deletion-memory, concurrent-history, trip-store-write, and unused-promote candidates remain outside this batch.
