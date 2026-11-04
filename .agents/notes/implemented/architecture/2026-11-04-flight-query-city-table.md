# Agent Note: the flight query parser finds Chinese cities in the airport table

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

`parseFlightQuery` strips known Chinese lead-ins (`LEADING_CN`) from the origin, but Han text has no
word boundary, so any lead-in that is not on that list stays attached: "你好洛杉矶到东京" asks the
flight search for the airport code of "你好洛杉矶", which fails as an unsupported location. The
failure cases are in `packages/orchestrator/tests/flight-query-cn-lead-in.failures.md`.

## Decision

`@trip/tools` exports `knownCitySuffix(text)`, which returns the longest trailing part of the text
that names a city in `packages/tools/src/airports.ts`, the same table the SerpApi flight search
uses to pick an airport code. For an origin or destination in Han script, `city()` in
`packages/orchestrator/src/chat/flight-query.ts` keeps that suffix; when no suffix is a known city,
the value is kept as it was. English names are unchanged, because spaces already mark word
boundaries there.

## Alternatives considered

- Adding greetings and polite phrases to `LEADING_CN`: covers only the listed words, and the next
  unlisted lead-in fails the same way.
- Word segmentation with `Intl.Segmenter`: it splits "悉尼" into "悉|尼" and "布宜诺斯艾利斯" into five
  pieces, so it cannot tell where a city name starts.
- A second city list in the orchestrator: it would drift from the table the flight search actually
  resolves against.

## Consequences

- The `@trip/tools` entry point grows by one read-only function. It returns a name, not an adapter,
  so the [provider-selection boundary](2026-10-03-deep-provider-selection.md) still holds;
  `packages/tools/tests/public-boundary.test.ts` lists it.
- A Chinese city is found after any lead-in only when it is in the airport table. Adding a city to
  `airports.ts` makes both the parser and the search accept it.
- If a lead-in plus a city happens to form a longer name in the table, the longer name wins.
