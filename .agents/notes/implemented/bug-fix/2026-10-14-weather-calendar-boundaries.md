# Agent Note: Weather provider windows use destination calendar dates

Status: implemented

## Problem

The original forecast-horizon note listed Google Weather through offset 10, although the provider
supplies ten daily entries from the destination's current date, covering offsets 0–9. That mismatch
could select a provider whose response does not include the requested date.

## Decision

`WeatherPort` calculates the offset using destination-local calendar dates. Google Weather serves
offsets 0–9. Open-Meteo serves offsets 10–14 with a 15-day forecast request. Offset 15 and later
uses historical climate context. A live forecast is usable only when its evidence contains the exact
requested destination date; missing evidence remains unavailable rather than being presented as a
forecast. These boundaries and the correction to the original note are recorded in the
[forecast-horizon decision](../feature/2026-09-21-weather-forecast-horizon.md).

## Alternatives considered

No alternative routing policy was weighed in this correction; provider capability and the existing
14-day forecast limit determine the boundaries.

## Consequences

- Offset zero is covered explicitly alongside both provider boundaries and the last forecast day.
- UTC and destination-local date differences must not shift the requested calendar day.
- Offsets beyond 14 remain climate context, not forecasts.

## Sources

Issue #327 and [the 2026-10-14 session log](../../../session-logs/2026-10-14-issue-326-327-review-fixes.md).
