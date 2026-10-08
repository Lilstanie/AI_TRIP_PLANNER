# Agent Note: Budget entry preserves its stated currency

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

An AUD-only budget field cannot preserve a traveller's CNY amount. Repeated conversion can change
the displayed original, and using a trip currency as an account default changes unrelated trips.

## Decision

The budget draft stores optional budgetSource alongside AUD budgetTotal. Its field uses the stated
source currency, or Settings displayCurrency when absent. Saving preserves amount and currency,
then shared toAud supplies the AUD total. Source metadata is retained only when it matches that
AUD total. Chat and form budgets meet at the existing TripBrief/known-brief boundary; its schema
is unchanged. A trip never writes the Settings currency. New trips return to Settings.

Snapshots write version 4. Version 3 already contains AUD, so it remains readable; when its draft
budget matches its plan, the plan's source is recovered. Pre-AUD versions 1 and 2 remain rejected.
The currency choice in the first paragraph is superseded by
[trip display currency](2026-10-07-trip-display-currency.md): a named currency comes first.
This supplements [catalog storage](../architecture/2026-09-24-workspace-catalog-trip-storage.md)
and [display conversion](2026-10-04-workspace-display-currency.md); their other rules stay in force.

## Alternatives considered

- Store only the converted total: loses the original amount and its meaning.
- Change Settings whenever chat states a currency: affects unrelated trips.

## Consequences

Agents and guardrails continue reading AUD. Source-currency budgets display their original amount;
other trip amounts use the shared approximate table. Invalid input stays inside ordinary form
validation, and stale source metadata is dropped instead of silently mislabelling another budget.

## Sources

- [Spec #145](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/145)
- [Ticket #150](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/150)
