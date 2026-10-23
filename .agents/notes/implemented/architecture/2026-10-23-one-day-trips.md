# Agent Note: One-destination trips without accommodation may last one day

Status: implemented

## Problem

`TripBrief` required at least one night per destination, so a trip starting and ending on the same
day was rejected. When a traveller asked for one day, the model's dates question still offered
"Keep it a single day and skip accommodation costs". Choosing it led to a refusal and an offer of a
two-day trip instead (#539). A day visit is a normal trip, and `noAccommodation` already expressed
"no stay".

## Decision

The `TripBrief` date check in `packages/shared/src/contracts.ts` accepts `dates[0] === dates[1]` only
when the destination is a single city and `noAccommodation` is `true`. Every other trip still needs
`end > start` with at least one night per destination, and the error message says how a one-day trip
qualifies. `mergeBriefPatch` in `packages/orchestrator/src/brief.ts` sets `noAccommodation: true`
when a patch leaves the dates on the same day and the flag is unset, so "1 day in Sydney" plans
without another question. An explicit `false` is still rejected. `applyBriefPatch` refuses only
reversed dates, `statedTripDays` reads "1 day" as a length, and the transport and dining day counters
accept zero nights. The workflow already skips accommodation for `noAccommodation`, so no stay is
searched or costed. The chat prompt tells the model a one-day trip is valid.

This partly replaces the validation-floor sentence in
[A trip's end date is its last day](../bug-fix/2026-10-15-trip-day-count-inclusive.md). It builds on
[No accommodation as an explicit trip constraint](2026-10-17-no-accommodation.md).

## Alternatives considered

- Stop offering the single-day option, by changing only the prompt and keeping the one-night floor.
  Joey rejected this on the #539 decision card, because a one-day visit should be plannable.

## Consequences

- One-day trips plan as day 1 only, without an accommodation section, in chat and through the API.
- A same-day brief from the Trip details form, without "No accommodation", still shows the dates
  error. The message now names the one-day exception.
- Consumers of `TripBrief` can no longer assume `nights >= 1`. Any new per-night arithmetic must
  handle zero, or run only when accommodation is planned.

## Sources

- #539 and its decision card (2026-10-23)
- `packages/shared/src/contracts.ts`, `packages/orchestrator/src/brief.ts`,
  `packages/orchestrator/src/chat-offline.ts`, `packages/agents/src/transport/validation.ts`,
  `packages/agents/src/dining/index.ts`
- `apps/web/tests/e2e/one-day-trip.e2e.mjs`
