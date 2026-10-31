# Agent Note: the itinerary and the conflict check read the same outbound landing

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

A live Sydney to Tokyo trip on 2026-10-30 put 浅草寺 on day 1 at 15:00 while the overnight flight
landed on day 2 at 08:50. Only `detect_conflicts` in `packages/orchestrator` read the selected
outbound flight, so the itinerary planned the day in the air and the plan came back as needing the
traveller.

## Decision

- `outboundArrival(brief, proposals)` in `packages/shared/src/arrival.ts` returns the landing day and
  time of `flight-0`'s selected candidate, from its last outbound segment. Both the itinerary and
  `detect_conflicts` call it, so they cannot disagree about when the traveller lands.
- It lives in `@trip/shared` because `conflicts.ts` is also bundled into the web client (through
  `plan-totals.ts`), and importing `@trip/agents` there pulls server-only modules such as
  `node:async_hooks` into the client build.
- The itinerary plans nothing before landing day and starts that day's stops 90 minutes after
  landing; a landing after 16:00 leaves that day empty. Days in the air are travel days, not
  incomplete days, and the model's draft need not cover them.

## Alternatives considered

**Keep two copies of the arrival parsing.** Each copy could drift (another flight, segment or date
format), and then one side would flag a plan the other side built.

**Export the helper from `@trip/agents`.** It broke the web build: the client bundle cannot load the
agents package.

## Consequences

- `packages/shared` gains one pure function; no existing type changes.
- The 90-minute airport exit is fixed; it does not know the airport or immigration queues.
