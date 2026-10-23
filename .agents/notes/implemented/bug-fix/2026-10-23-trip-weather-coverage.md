# Agent Note: Weather covers every destination and trip date

Status: implemented
Owner: D (@jbia0391)

## Problem

The guide fetched only the first travel date. Repeating the whole forecast request for every date
would multiply paid requests even though one response covers several dates.

## Decision

Gather every city/date combination with at most three concurrent lookups. Keep missing coordinates,
date mismatches and provider errors as explicit unavailable entries. Preserve the existing
[destination calendar boundaries](2026-10-14-weather-calendar-boundaries.md) and per-entry provenance.
Reuse successful HTTP responses within one tool gateway instance, including in-flight requests.

## Alternatives considered

Inferring one stay schedule would reduce lookups but risks omitting destinations before their actual
stay arrangement is known. Checking every city/date covers the brief without inventing that schedule.

## Consequences

Long trips need more dated evidence. Forecast responses are shared, while different climate archive
windows can still require separate requests. Mock mode stays offline; unavailable dates remain visible.

## Sources

Jira TP-38; packages/orchestrator/tests/trip-weather-coverage.e2e.test.ts.
