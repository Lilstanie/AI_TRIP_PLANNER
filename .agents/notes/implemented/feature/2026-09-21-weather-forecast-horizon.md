# Agent Note: Weather is a forecast only within 14 days, climate context beyond

Status: implemented
Owner: D (@jbia0391)

## Problem

The destination guide described weather only as monthly context. Travellers leaving soon need an
actual forecast, but a forecast for a date weeks away does not exist, and presenting seasonal
averages as a forecast would mislead them.

## Decision

`packages/tools/src/weather.ts` implements `WeatherPort` and chooses by days until the target date:

| Days until the date | Source                               | `horizon`  |
| ------------------- | ------------------------------------ | ---------- |
| 0–10                | Google Weather API daily forecast    | `forecast` |
| 11–14               | Open-Meteo forecast                  | `forecast` |
| 15 or more          | Seasonal climate fixture, no network | `climate`  |

Mock mode returns fixtures for every horizon without network calls. A forecast result carries
`observedAt` and `validUntil`; climate text says it is historical guidance, not a forecast. The
destination guide receives the result through the tool gateway, records provider, horizon and time in
its assumptions and `source`, and reports weather as unavailable when the provider fails instead of
blocking the plan. `WEATHER_API_KEY` is optional and falls back to `MAPS_API_KEY`.

## Alternatives considered

**Google Weather only.** Rejected: its daily forecast stops at 10 days, short of the 14-day boundary.

**Use web search results for weather.** Rejected: unstructured search results are not weather data
and carry no forecast time or validity.

**Show a forecast at any distance.** Rejected: beyond two weeks it would be climate data labelled as
a forecast.

## Consequences

- Two live providers must stay in agreement on units and wording.
- Trips starting more than 14 days out never show live weather, however accurate a provider claims
  to be.

## Sources

Commit f0ac1da (`feat: add forecast and climate weather capability`, PR #33) and the archived
[product closure TODO](../../../archive/todo-product-closure.md).
