---
date: 2026-10-19
author: Codex
branch: feature/long-term-memory-integration
pr: none
area: apps/web, packages/agents, packages/orchestrator, docs
contract-impact: none
---

# Integrate long-term preference memory with planning specialists

## What changed

- Connected six account-memory categories to the corresponding planning specialists and surfaced confirmed preferences in their evidence/assumptions.
- Added trip/profile/account-memory precedence, including category-specific matching that avoids suppressing interests for unrelated text such as “food tours”.
- Shared production memory recognition and precedence logic with the browser E2E, and updated API, architecture, workspace and development docs and Agent Notes.
- Expanded the browser E2E to cover six categories, memory opt-out, profile/trip precedence, and stored-value preservation.

## Why

The integration needs account memories to influence planning only when trip-specific and profile preferences leave that category blank. The deterministic E2E boundaries keep Clerk and Neon credentials out of this local run.

## Validation

- `pnpm --filter @trip/web build` — passed.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm --filter @trip/web lint` — passed.
- `pnpm --filter @trip/web test` — 57 files, 632 tests passed; jsdom logged Canvas-not-implemented warnings.
- `pnpm --filter @trip/orchestrator test` — 22 files, 249 tests passed.
- `pnpm --filter @trip/orchestrator typecheck && pnpm --filter @trip/agents typecheck` — passed.
- `PLAYWRIGHT=/private/tmp/playwright-chrome.cjs pnpm --filter @trip/web e2e long-term-memory` — passed; artifact `apps/web/output/e2e/runner/2026-10-19T00-24-32-373Z.json`.
- `pnpm verify:docs && pnpm verify:protected && pnpm verify:pairs && pnpm format:check-changed origin/main && pnpm verify:e2e-selectors && pnpm verify:e2e-artifacts` — passed.
- `git diff --check origin/main` — passed before this session-log addition.

## Notes for the next person

The browser E2E uses route fixtures and PGlite; it does not exercise Clerk/Neon auth or real specialist-generated sections. Spec review identified that specialist-output E2E evidence as a remaining acceptance gap. No PR was opened and no push or merge was performed.
