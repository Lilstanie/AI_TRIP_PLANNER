---
date: 2026-10-07
author: Claude
branch: feature/226-money-formatter
pr: none
area: packages/shared, packages/agents, packages/orchestrator, docs
contract-impact: packages/shared
---

# One shared formatter for amounts in generated text (#226)

## What changed

- `packages/shared/src/money.ts`: `formatMoney(amountAud, currency, style?)`, converting through `AUD_PER`, JPY without decimals.
- Replaced the inline `AUD ${...}` strings in `packages/agents/src/{dining,accommodation,transport}`, `packages/orchestrator/src/{workflow,supervisor,conflicts,progress-tools,chat,board}.ts`, `agent-lab/multi-agent-fixture.ts` and `shared/src/describe.ts`.
- Docs: `docs/workspace-ui.md` and its `.zh.md` pair; Agent Note `2026-10-07-one-money-formatter-for-generated-text.md`.

## Why

The ticket says no Agent Note, but adding an export to `packages/shared/src` makes `verify:protected` demand one, so the note is there. Every caller passes AUD; #228 passes the display currency.

## Validation

- Failure inventory and `formatMoney` tests written first (red: `formatMoney is not a function`), then the code (green).
- `pnpm typecheck` passed (6 tasks); `pnpm lint` passed (web only has a lint task).
- `pnpm --filter @trip/shared --filter @trip/agents --filter @trip/orchestrator test`: 58, 124, 227 tests passed.
- `agent-lab-comparison`, `agent-lab-revision`, `agent-lab-single-agent` E2E passed. Before/after NDJSON and artifacts (24 files, up to 95 AUD strings each) are identical apart from run ids and timestamps.

## Notes for the next person

Left as is on purpose: fixture literals (`agent-lab/paris-family.ts`, `tokyo-kyoto.ts`), static notes without an amount ("AUD per room per night"), prompts, and `apps/web/lib/dev/thinking-fixtures.ts`.
