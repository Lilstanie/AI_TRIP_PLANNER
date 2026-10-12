---
date: 2026-10-11
author: Codex
branch: main
pr: none
area: apps/web, docs, .github
contract-impact: none
---

# Improve E2E reliability and remove repeated workspace work

## What changed

- Raw runner owns unique build/config resources and captures timeout child identity; interrupted reports stay incomplete.
- Shared persistence writes each successful catalog object once; hidden/background maps pause route animation and OSM omits its unsupported dash loop.
- Add sequential CLI CI acceptance, production performance acceptance and browser/process evidence.
- Update paired docs and the [implementation decision](../notes/implemented/testing/2026-10-11-e2e-performance-acceptance.md); retain R3–R5 follow-ups in the proposal.

## Why

The user approved T1–T3, R1–R2, R3 measurement and `.github/workflows/ci.yml` changes. Keep the current CLI and project E2E-first rules.

## Validation

- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint`: passed.
- `pnpm --filter @trip/web test`: 52 files, 622 tests passed; existing jsdom canvas warnings remained.
- `pnpm test:scripts`: 35 passed. Production baseline/final builds passed.
- `node apps/web/tests/cli-e2e/run.mjs`: all 8 scripts passed; earlier failures remain in separate invocation folders.
- `node apps/web/tests/e2e/run-performance.mjs`: passed, including 4 workspace scenarios and 90 map assertions.
- Comparable production baseline/after: settled catalog writes 2 → 1; planned mirror and stale-tab guards passed.
- Direct replay cancellation/offline verification passed; earlier fixture timing/prefetch failures are retained.
- `node apps/web/tests/e2e/run.mjs doctor --json`: ready after Chromium installation.
- `pnpm verify:docs`, `pnpm verify:e2e-selectors`, scoped Prettier and `git diff --check`: passed.
- `pnpm verify:protected` and `pnpm format:check-changed origin/main`: passed for committed history only; working files were reviewed separately.
- `pnpm verify:pairs`: blocked only by pre-existing `docs/design/ui-guidelines.md` stale review; four changed pairs were reviewed and recorded.

## Notes for the next person

- Evidence index: `output/e2e/performance-review/2026-10-11/index.md`; repeat commands are in [development](../../docs/development.md#workspace-performance-acceptance).
- R3 only measured: MessageItem calls 30/600/600 for typing/save and 44/804/804 for synthetic stream; these are not React commits or speedup claims.
- CI configuration has not run on GitHub. Google is stubbed; MapLibre uses an empty style. No live-provider result is claimed.
- Owned measurement servers stopped and temporary configs removed. No commit or push; unrelated dirty files remain.
