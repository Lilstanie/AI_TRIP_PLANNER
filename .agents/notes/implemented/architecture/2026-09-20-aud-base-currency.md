# Agent Note: AUD is the single stored currency

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

The UI showed USD while travellers stated budgets in other currencies such as CNY. Amounts,
identifiers such as `priceUsd`, and about 30 UI strings all assumed USD.

## Decision

`packages/shared/src/money.ts` defines `BASE_CURRENCY = "AUD"`. Every stored and displayed
amount is AUD; nothing downstream carries a currency. A budget stated in another supported currency
(CNY, USD, JPY) is converted once, where it is read from the traveller's message, using static
rates in `money.ts`, and the original is shown alongside (for example "AUD 630.00 (≈ ¥3,000.00)").
Identifiers no longer name a currency (`price`, `pricePerNight`, `sumMoney`), and UI amounts go
through `money()`. Provider-native fares shown as evidence keep their own currency and stay out of
totals.

## Alternatives considered

**A live exchange-rate service.** Rejected: rates are static and reviewable in code. A rate
invented by a language model would skew every budget guardrail with nothing to catch it.

**Migrate old saved trips.** Rejected: their amounts meant USD and there is no defensible rate for
a snapshot of unknown date.

## Consequences

- Trips saved before the change do not reopen: snapshots moved to version 3 and older versions are
  rejected.
- Static rates are approximate and must be reviewed by hand.

## Sources

Commit 12656a5 (`refactor: make AUD the base currency everywhere`) and b846a24
(`fix(tools): keep grounded prices in AUD`).
