# Agent Note: Dietary restaurant searches keep category metadata intact

Status: implemented
Owner: D (@jbia0391)

## Problem

Dining knows the traveller's dietary requirements but generic restaurant searches omit them.

## Decision

PlaceQuery gains optional textQuery. Google Places and OSM use this text while near and category
retain their established meanings. Without textQuery, existing callers keep the category/city query.
The tool gateway and progress wrapper preserve the field. Mock mode remains offline.

## Alternatives considered

Putting dietary prose in category avoids a contract addition but corrupts the restaurant category
used in candidates and progress. An optional search field preserves that metadata.

## Consequences

The addition is backward-compatible and changes no persisted plan or HTTP request schema. Search
relevance does not verify dietary suitability, ingredients or cross-contamination controls.

## Sources

Jira TP-43, dependent on TP-41; packages/orchestrator/tests/dietary-restaurant-search.e2e.test.ts.
