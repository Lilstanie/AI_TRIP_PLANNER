# Agent Note: generated text groups AUD thousands like the panels

Status: implemented
Owner: A (@Lilstanie)

## Problem

Server-written text spelled AUD amounts without a thousands separator (`AUD 1166.66`, `AUD 4000`),
while the Trip panel, top bar and trip cards group them (`AUD 1,166.66`, `AUD 4,000`). One trip
showed the same amount two ways on one screen (#395). Converted currencies already grouped, so AUD
was the only exception.

## Decision

`formatMoney` in `packages/shared/src/money.ts` groups thousands for AUD in every style: `cents`
(`AUD 1,400.00`), `whole` (`AUD 1,582`, unchanged) and `plain` (`AUD 4,000`, a budget as typed, with
no decimals forced). AUD `cents` now shares the `toLocaleString("en-AU")` path the other currencies
use. This partly supersedes two notes: the "AUD keeps its ungrouped spelling" clause of the
[display currency note](../feature/2026-10-07-trip-display-currency.md), and the byte-for-byte AUD
promise and style examples of the [one-formatter note](2026-10-07-one-money-formatter-for-generated-text.md).
Their other decisions stand.

## Alternatives considered

**Post-process the reply text in the web layer.** Rejected in the triage of #395: the amounts are not
written by the model but by `formatMoney`, so fixing the formatter fixes every caller at once, and
parsing amounts back out of prose is what the one-formatter note set out to avoid.

**Leave AUD ungrouped and document the difference.** Rejected by the owner: the mismatch is visible
on one screen.

## Consequences

- Agent Lab trace text changes for any AUD amount of four or more digits. No committed fixture holds
  such text, and `reportsInfeasibleBudget` in `packages/orchestrator/src/agent-lab/evaluate.ts`
  already strips commas when it reads an amount back.
- Code that reads an amount out of generated text must accept commas; the tests that did not were
  updated.

## Sources

- Issue #395 and its owner decision comment.
- [2026-10-16 grouped money text log](../../../session-logs/2026-10-16-grouped-money-text.md)
