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

## Request field

`ChatRequest` gains an optional `displayCurrency` (a supported `Currency`): the Settings display
currency, sent by the browser with every request the way `interfaceLanguage` is. It is only the last
step of `effectiveCurrency` on the server (`brief.displayCurrency`, else `budgetSource.currency`, else
the request's value); absent means AUD, so an older client is written to in AUD, and an unsupported
code is a 400. The server never writes Settings.

Every traveller-facing amount the server writes goes through `formatMoney(amountAud, currency)` with
that currency: specialist summaries and notes that carry an amount, conflict reasons and constraints,
coordinator and specialist progress lines, budget allocation bases and the fallback replies, the
impossible-budget reply included. The orchestrator hands the currency to specialists as
`AgentContext.displayCurrency` (`displayCurrencyOf(brief, context)` reads it) and to the conflict, board
and progress helpers as an argument defaulting to AUD, so Agent Lab (fixed AUD scenarios, no currency
named) is byte-for-byte unchanged. The facts handed to the reply model carry amounts already converted
and formatted, plus an `amountsNote`, and the prompt says to quote them as given and never convert.
Converted amounts group thousands like the panels (`CNY 3,000.00`; AUD keeps its ungrouped spelling),
the budget quotes the stated amount when it is in the display currency, and `estimateNote()` marks the
fallback replies and the reply facts as estimates. Planning amounts, guardrails, conflict detection, the
plan score and provider fares are untouched and stay AUD or in the provider's own currency.

The plan editor follows the same rule: `EditRequest.displayCurrency` carries the Settings currency, and a
swapped stay's sentence, the recomputed conflicts and the before and after use `effectiveCurrency`. The
unit notes ("per room per night", "All amounts are ...", the fare freshness line) name the display currency
and add `estimateNote()` when it is not AUD. The budget objects in the stay and transport model prompts keep
`maxTotalCost` in AUD and label it, with the currency their `basis` text uses.

## Alternatives considered

- Keep source currency, else Settings: leaves a currency named alone, and any later request, ignored.
- Rewrite `budgetSource` when the traveller names another currency: loses the stated amount.
- Write the named currency to Settings: one chat would change every other trip and chat.
- Guess a currency from the chat language or destination: rejected in
  [spec #145](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/145) and again in spec #225.

## Consequences

Several trips and chats open at once cannot conflict, because the currency lives on each brief and
Settings is only the default. A Settings change reaches only trips that never named a currency.
`effectiveCurrency` is exported for the server too, and the server uses it for the text it writes
(see Request field below). The offline detector reads any currency marker, so a stray marker in a message (bare 元)
names a currency. The Your trips cards now end with each trip's total in its own currency.

## Sources

- [Spec #225](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/225)
- [Ticket #227](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/227)
- [Ticket #228](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/228)
- Joey approved the `packages/shared` change in the project thread on 2026-10-07.
