# Agent Note: Flight answers carry Google Flights' price insight

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

A flight answer listed fares with no sense of whether they were cheap for the route, so the traveller
could not tell whether to book now or wait. SerpApi's Google Flights response already contains
`price_insights` (price level, typical range, about 60 days of daily lowest fares), and the adapter
dropped it. Joey picked this after reviewing the open-source `dengmeiluan/ticket-monitoring` project
on 2026-11-02, which scrapes five Chinese booking sites and stores daily prices to draw trends.

## Decision

- `packages/shared`: `FlightPriceInsight` (`level` low | typical | high, optional `typicalRange`,
  optional `history` of `{ date, price }`) is optional on `FlightOption.priceInsight` and on
  `FlightAnswer.priceInsight`. Amounts are AUD on the same whole-party basis as the options.
- `packages/tools/src/serpapi.ts` parses `price_insights` from the outbound search, drops malformed
  values, keeps history only with two or more points, and attaches the same insight to every option of
  that search. Fixture flights carry none.
- `answerFlightQuery` copies the first insight into the answer and adds one sentence to the reply:
  low means booking soon is reasonable, high suggests nearby dates or waiting, typical states it is
  normal. Nothing is said when there is no insight or no fare.
- `FlightResults` shows the level, the typical range in the display currency and an SVG trend line.
  Its copy lives in `apps/web/lib/i18n/messages/{en,zh}-fares.ts`, outside `MessageKey`, because
  adding keys to the workspace dictionary hits TS2590 on the `Notice` union.

## Alternatives considered

**Scrape and store our own daily prices, as ticket-monitoring does.** Rejected: it needs a scheduled
job, a new table and scraping that breaks when sites change, while Google already publishes the
history in the response we pay for.

**Price watch with a target price and alerts.** Deferred: it needs a cron and deploy changes that only
Lilstanie can make; this insight is the data such a watch would show.

**Have the model write the buy-or-wait advice.** Rejected: the flight answer is deterministic and
fast; a rule on Google's level says the same thing without another model call.

## Consequences

- No extra SerpApi call and no new quota use; the insight comes from the search already made.
- Only the chat flight answer shows it. Planner flight legs (`packages/agents/src/transport`) ignore
  the field.
- The level is Google's judgement; when Google returns no insight, the answer looks as before.
