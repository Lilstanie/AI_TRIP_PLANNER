# Product roadmap

The near-term target is a reliable single-user workspace: describe a trip, inspect grounded
recommendations, edit the plan, save it and use it while travelling.

## Status

Status as of 2026-09-22 on `main`; see [workspace UI](workspace-ui.md) for current behaviour.

**Done**

- LangGraph planning workflow with five LangChain specialists and targeted revision.
- Single-user workspace: chat, preferences, controlled filters, detail cards, loading and error
  states, and example trips from a blank chat.
- Editable timeline and Google map with route, time and budget checks.
- Live data behind a per-request mock/live toggle: Google Places grounding, SerpApi hotel and flight
  search, weather forecast and climate evidence.
- Visible provenance: every proposal reports whether its data is live, estimated, mock, fallback or
  unavailable.
- Storage: saved trips in the browser; chat turns, preferences, plans and SerpApi usage and cache in
  the Redis REST store when configured.
- Streaming planning progress and a thinking transcript in the chat.

**Open**

1. Verify live providers end to end with real keys in a deployed environment.
2. On-trip mode, once the describe, edit, save and travel loop is stable.

**Later, only if needed**

- Flight delays, gates and operational status through a dedicated provider such as Aviationstack.
- Affiliate inventory or booking links through a provider such as Travelpayouts.

## Definition of done for the MVP

- Users can enter destination, origin, dates, travellers, budget and preferences.
- Recommendations are grounded and labelled with their source and freshness, including live,
  estimated and mock provider states.
- Users can inspect and edit real detail cards rather than raw JSON.
- Time, route and budget conflicts are visible after edits.
- Saved trips reopen after refresh.
- Provider failures degrade visibly and safely without silently substituting fictional prices.
- Typecheck, tests, lint and production build pass before merge.

## Out of scope for now

Multi-user collaboration, social features, creator marketplace, in-app payments, refunds and booking
fulfilment should not block the single-user product.
