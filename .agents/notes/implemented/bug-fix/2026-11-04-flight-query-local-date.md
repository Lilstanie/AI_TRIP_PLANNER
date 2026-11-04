# Agent Note: Flight questions read yearless dates in the traveller's time zone

Status: implemented

## Problem

`parseFlightQuery` rolls a month-day without a year to next year when it falls before today, and it
took today from the UTC calendar day. At 08:00 on 1 Mar in Sydney (21:00Z on 28 Feb), "flights from
Sydney to Tokyo on Feb 28" departed on 2026-02-28, a day already past for the traveller. In a US
evening, UTC is on the next day, so "Nov 4" asked on 4 Nov jumped to the next year. The chat request
carried nothing that said which day it was for the traveller.

## Decision

`ChatRequest` gains an optional `timeZone` (`TimeZone` in `packages/shared/src/chat.ts`): an IANA
zone name that the runtime's `Intl` knows. Bare offsets such as `+11:00` are rejected, because they
ignore daylight saving. The web app sends `Intl.DateTimeFormat().resolvedOptions().timeZone` with
every chat request (`useWorkspaceTransport`). `apps/web/app/api/chat/route.ts` passes it to
`parseFlightQuery(message, now, timeZone)`, which takes the traveller's calendar day in that zone as
the earliest date. Without the field the day is UTC, so older clients get what they always got.

## Alternatives considered

- Origin coordinates through `localCalendarDate` (`packages/tools/src/timezone.ts`): the origin is a
  city name in the message, so it would need a geocoding call before a model-free answer, and the
  traveller is not always at the origin when they ask; "yesterday" is the asker's yesterday.
- A UTC offset in minutes: one number, but it describes only the current instant and cannot be
  validated against a zone database.

## Consequences

Only the parser path uses the field. The coordinator's `today` in its envelope still comes from the
destination's coordinates or UTC (`locationForBrief`), and `search_flights` dates come from the model
reading that envelope. Using `timeZone` as that fallback is a separate change. An unknown zone name
answers 400 instead of silently falling back to UTC. The failure inventory is
`packages/orchestrator/tests/flight-query-local-date.failures.md`.
