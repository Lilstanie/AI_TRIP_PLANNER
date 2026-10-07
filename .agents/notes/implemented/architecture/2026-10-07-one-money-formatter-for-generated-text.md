# Agent Note: one formatter spells every amount in generated text

Status: implemented
Owner: A (@Lilstanie)

## Problem

The specialists and the orchestrator wrote AUD amounts into traveller-facing text in about 29 places
(summaries, conflict reasons, progress lines, budget bases, fallback replies), each with its own
inline `AUD ${n.toFixed(2)}` or `toLocaleString`. Showing a trip in another display currency (#225)
would have meant touching every one of them, and a missed one would still say AUD.

## Decision

`formatMoney(amountAud, currency, style?)` in `packages/shared/src/money.ts` is the only code that
spells an amount in generated text. It takes an AUD planning amount, converts through `AUD_PER` when
the currency is not AUD, and shows JPY without decimals. Styles: `cents` (default, `AUD 12.50`),
`whole` (`AUD 1,582`) and `plain` (`AUD 4000`, a budget as typed). It throws on a non-finite amount
instead of printing `AUD NaN`.

Every caller passes `"AUD"` in this change, so each string is byte-for-byte what it was; the Agent Lab
trace text (24 NDJSON and artifact files, fixture mode) was compared before and after. Planning
arithmetic, model prompts and static provider notes are untouched. The module lives in
`@trip/shared` because the agents, the orchestrator and `describe.ts` all depend on it and nothing
else is common to them.

## Alternatives considered

**One helper per package.** Needs no shared change, but the orchestrator and agents would each own a
copy of the rate handling, and `describe.ts` could not use either.

**Convert in the web layer only.** Generated sentences are already text by the time the web app
receives them, so converting there would mean parsing amounts back out of prose.

## Consequences

- A new traveller-facing amount in generated text goes through `formatMoney`; hand-built `AUD ${...}`
  strings are the defect this removes.
- The currency argument is required, so a later caller cannot forget it. Passing the trip's display
  currency is done (#228, see [the display currency note](../feature/2026-10-07-trip-display-currency.md)).
- `NaN` or infinite amounts now fail loudly where they used to print `AUD NaN`.
