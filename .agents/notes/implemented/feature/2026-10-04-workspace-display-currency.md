# Agent Note: Approximate display conversion uses the shared AUD rate table

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

Travellers reading CNY, USD or JPY must mentally convert every AUD estimate. A web-owned rate
table could disagree with budget extraction and quietly change the meaning of an estimate.

## Decision

UserSettings defaults displayCurrency to AUD and accepts the shared supported currencies.
The shared money module exposes fromAud for display, using the same static AUD_PER table as
toAud. Zero costs and signed differences are valid display values; non-finite values are rejected.
LocaleProvider supplies the effective currency and one formatter to all workspace amounts.
JPY has zero decimal places; other currencies have two. Converted amounts show an estimate notice
with RATES_AS_OF. Provider-native fare evidence stays unconverted. Rates are approximate planning
figures, not market quotes.

A trip's effective currency is now chosen by [trip display currency](2026-10-07-trip-display-currency.md).
This extends the display restriction in [AUD base currency](../architecture/2026-09-20-aud-base-currency.md)
and [interface language](2026-10-04-interface-language-only.md); their planning and language decisions
remain in force. Only the display direction gains a second use; agents and guardrails stay in AUD.

## Alternatives considered

- Copy rates into the web app: rejected because the two tables can drift.
- Guess destination currency: rejected by [spec #145](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/145).
- Use a live exchange-rate service: outside the accepted scope.

## Consequences

Older settings parse with AUD. Display changes never rewrite planning data. The rate table must
still be reviewed manually, and the notice explains its limitations.
