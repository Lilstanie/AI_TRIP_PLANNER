---
date: 2026-10-30
author: Claude Code
branch: feature/TP-185-stay-partial-preference
pr: none
area: packages/agents, packages/orchestrator tests, docs
contract-impact: none
---

# Stay choice ranks partial preference matches

## What changed

- `packages/agents/src/accommodation/planning.ts`: `chooseInitial` takes the cheapest candidate
  meeting the most of rating ≥ 8 and free cancellation, instead of the cheapest when none meets both.
- `packages/agents/tests/accommodation/index.test.ts` and `partial-preference.failures.md`.
- `packages/orchestrator/tests/weather-provider-planning.e2e.test.ts`: fixture total 4,333.20 →
  4,426.64 (Economy with free cancellation replaces Saver in Tokyo and Kyoto).
- Agent Note `2026-10-30-stay-partial-preference.md`; Stage 1 use-case 7a and behaviour diagram wording.

## Why

Found in the UI loop: changing a Lisbon trip from two to four travellers swapped the Standard hotel
for the Saver (7.2, no free cancellation) although the Economy (7.6, free cancellation) also fit.

## Validation

- New accommodation test failed first (Saver chosen), then passed; agents vitest 190 passed,
  orchestrator vitest 417 passed.
- `/api/chat` against dev (mock data), Lisbon 2 → 4 travellers: stay was `Mock Lisbon Saver` at
  AUD 80, now `Mock Lisbon Economy` at AUD 100.

## Limitations

- Dining stays a fixed share of the budget, so its estimate barely moves with group size; that is
  the existing dining design, not changed here.
