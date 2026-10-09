---
date: 2026-10-10
author: Codex
branch: feature/complete-map-fallback
pr: 278
area: apps/web, packages/shared, packages/agents, docs
contract-impact: packages/shared
---

# Fix the free-map fallback review findings

## What changed

- `plan-revision.ts` makes cross-tab stale background work terminal and shows a keyed Notice.
- Place details and manual replacement searches carry locale; manual searches retain data mode.
- `TravelModes` gains `cycle`, wired through the chooser, Google BICYCLE, OSRM bike, and saved plans.
- OSRM uses shared contact, timeout and successful-answer cache handling; identical requests coalesce.
- Input suggestions explicitly avoid Nominatim; paired docs and partially superseded decisions are synchronized.
- Decision: [map fallback review fixes](../notes/implemented/architecture/2026-10-10-map-fallback-review-fixes.md).

## Why

A background check queued behind another tab's edit retried 66 times in half a second without a
Notice. The regression now observes one attempt, then no retries and a stale-plan Notice. Details
lost Chinese names; cycling was specified but absent. Review also exposed the manual-search and
Nominatim autocomplete gaps; each gained a failing check before its fix.

## Validation

- `pnpm test`: 101 files / 1,161 tests passed; unchanged packages used Turbo's valid cache.
- `pnpm typecheck`, `pnpm lint`, `pnpm --filter @trip/web build`: passed.
- `pnpm test:scripts`: 26 passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`: passed (24 pairs).
- `pnpm format:check-changed origin/feature/trip-drawer-no-confirmations`, `git diff --check`: passed.
- `plan-revision.e2e.mjs`: passed; stale queued check fails before the fix and passes after it.
- `map-provider-http.e2e.mjs`: passed against local upstream stubs; locale/cache and no-autocomplete verified.
- `map-fallback.e2e.mjs`: passed; cycling, EN→ZH→EN details, Chinese manual search, desktop/phone, no external calls.
- `timeline.e2e.mjs`: 100 checks passed; `leg-mode-choice.e2e.mjs`: four deterministic mock scenarios passed.
- JSON/screenshots: `output/playwright/{plan-revision,map-fallback,timeline}/review-fixes-after`;
  HTTP evidence: `output/e2e/map-provider-http/summary.json`. These artifacts are local and ignored.
- Review baseline remains #258 (`1914fdc`); Spec reports no remaining findings. Standards findings
  were resolved; the final autocomplete increment was checked locally after its reviewer hit a usage limit.

## Retrospective

- Keep the queued cross-tab regression: idle stale-tab refusal alone misses repeated background offers.
- Keep automatic, manual and suggestion request paths in provider E2E; interface-language checks need all three.
- Check original decision links when extending a contract; the existing supersession workflow was initially missed.
- Run build before typecheck: concurrent build can remove generated `.next/types` while typecheck reads them.
  Use the package test command, which disables Node's experimental web storage for its existing browser tests.

## Notes for the next person

PR #278 remains stacked on #258. No physical-device or worldwide provider-coverage claim is made.
The chat-only model-dependent leg-choice scenario was skipped because no model key was configured.
No new unit test was added; the existing suggestion request assertion was updated before its API change.
