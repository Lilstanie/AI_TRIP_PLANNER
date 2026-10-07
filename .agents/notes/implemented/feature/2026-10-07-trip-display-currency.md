# Agent Note: A trip is displayed in the last currency the traveller named for it

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

A trip read in its source budget currency only when a budget was stated in that currency. Saying
"show it in yen" or "用人民币给我算" without a budget was ignored, and once a budget fixed the
currency nothing the traveller said later could change it. The earlier rule (source currency, else
Settings) also gave AUD no way to be chosen on purpose while Settings held another currency.

## Decision

`TripBrief` and `PartialTripBrief` gain an optional `displayCurrency` (a supported `Currency`). It is
set whenever the traveller names a currency for the trip, with a budget or on its own; the latest
naming wins, including over the budget's currency, and naming AUD sets AUD. It is absent until a
currency is named. `budgetSource` keeps the stated amount and currency and is not rewritten when the
display currency changes. Planning, guardrails, the plan score and stored amounts stay AUD.

`effectiveCurrency(brief, settingsCurrency)` in `packages/shared/src/money.ts` is the one rule:
`displayCurrency`, else `budgetSource.currency`, else the Settings display currency. The locale
provider (plan panel, chips, budget field), the trip cards and the trip list all call it. A trip saved
before the field existed has none, so it falls back to its source currency as before.

Both extraction paths set the field. The coordinator's `update_trip_brief` takes `displayCurrency`
without an amount (a currency named with a budget also sets it, and an explicit `displayCurrency`
outranks the budget's). The offline extractor sets it from `detectCurrency` on the message, with or
without a budget. A message naming no currency leaves it unchanged; a language is never read as a
currency. The browser keeps it on the draft (`Draft.displayCurrency`) beside `budgetSource`, so a blank
conversation carries it in `known` until the brief is complete, and it is saved with the snapshot. The
snapshot version stays 4: the field is optional and older snapshots parse without it.

This supersedes the currency-choice part of
[budget entry preserves its stated currency](2026-10-04-source-budget-entry.md) (the field uses the
source currency, else Settings). That note's storage, AUD recovery and "a trip never writes Settings"
rules stay in force. It extends [display conversion](2026-10-04-workspace-display-currency.md), whose
shared rate table and estimate notice are unchanged.

## Alternatives considered

- Keep source currency, else Settings: leaves a currency named alone, and any later request, ignored.
- Rewrite `budgetSource` when the traveller names another currency: loses the stated amount.
- Write the named currency to Settings: one chat would change every other trip and chat.
- Guess a currency from the chat language or destination: rejected in
  [spec #145](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/145) and again in spec #225.

## Consequences

Several trips and chats open at once cannot conflict, because the currency lives on each brief and
Settings is only the default. A Settings change reaches only trips that never named a currency.
`effectiveCurrency` is exported for the server too; text the server writes (specialist summaries,
conflict reasons, progress lines, replies) still says AUD until the follow-up ticket (#228) formats it
through it. The offline detector reads any currency marker, so a stray marker in a message (bare 元)
names a currency. The Your trips cards now end with each trip's total in its own currency.

## Sources

- [Spec #225](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/225)
- [Ticket #227](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/227)
- Joey approved the `packages/shared` change in the project thread on 2026-10-07.
