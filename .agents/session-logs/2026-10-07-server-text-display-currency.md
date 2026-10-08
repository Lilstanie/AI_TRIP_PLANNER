---
date: 2026-10-07
author: Claude Code (for Joey)
branch: feature/228-server-text-display-currency
pr: none
area: packages/shared, packages/agents, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# Server-written text shows amounts in the trip's display currency (#228)

## What changed

- `packages/shared`: `ChatRequest.displayCurrency` (optional Settings currency), `AgentContext.displayCurrency`
  with `displayCurrencyOf()`, `estimateNote()`, `formatMoney` groups converted amounts like the panels,
  `describeStayChoice` takes an optional currency.
- `packages/orchestrator`: `OrchestratorOptions.displayCurrency`; `effectiveCurrency` picks the currency once per
  run and reaches `detectConflicts`, the planning board (allocation bases), `choiceFor`, progress rows, the
  progress summaries, the fallback replies and the reply model's plan facts (amounts pre-converted, prompt rule).
- `packages/agents`: accommodation, dining and transport summaries and amount notes use the context currency.
- `apps/web`: the transport sends `displayCurrency: settings.displayCurrency` with every chat request.
- `trip-display-currency.e2e.mjs` extended (failure inventory first); docs in English and Chinese; Agent Note updated.

## Why

Joey approved the `packages/shared` change for spec #225. Planning, guardrails, conflict detection, the plan
score and provider fares stay AUD; only how text spells an amount changes. Agent Lab passes no currency, so it
stays AUD. The JPY expectation in `money.test.ts` changed from `JPY 1250` to `JPY 1,250` on purpose.

## Validation

- Red first: 4 API checks and the CNY text checks failed ("AUD" in summaries and reply), then 109/109 green
  at 1440 and 390 px (`output/playwright/trip-display-currency/summary.json`).
- `e2e display-currency source-budget ui-language reply-language agent-lab-comparison agent-lab-revision
  agent-lab-single-agent`: passed.
- `pnpm typecheck`; `pnpm --filter @trip/{shared,agents,orchestrator,web} test`: 58, 124, 227, 596 passed.

## Notes for the next person

- Left on purpose: the plan editor preview (`apps/web/lib/trip/trip-edit.ts`) and static notes such as
  "AUD per room per night". Model prompts keep `basis` text beside the AUD `maxTotalCost`.
- "Provider fares are not converted" is untouched code, covered by the existing display-currency and
  source-budget scripts, not a new check.
