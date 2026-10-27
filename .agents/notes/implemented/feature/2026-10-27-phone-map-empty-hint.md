# Agent Note: Map without a trip shows a basemap and one hint

Status: implemented
Owner: spec #730, ticket #737

## Problem

The phone Map tab with no trip stacked three messages that all said "nothing yet": a location
permission card, a "Your map will appear here" card on a grey void, and an empty Day stops sheet.
The [location prompt note](2026-09-24-location-prompt-and-itinerary-map.md) decided to ask for the
traveller's location when the workspace opens.

## Decision

- With no trip, `TripMapCanvas` renders the real basemap with one `glass-float` hint, "Where are you
  going?". On the phone it carries one button, Plan in Chat. The old placeholder card remains only for
  a destination that cannot be placed.
- The basemap centres on the travel profile home city, resolved by `useHomeBase` through the places
  search route, else a world view. Nothing is stored. The map runs quiet: a failing style or tile
  request leaves the hint on a plain background with no alert or Retry map button.
- Supersedes the opening location question: `LocationPrompt` and the `asking`, `allow` and `dismiss`
  state are removed. Location is asked only when Show my location is pressed; a granted earlier press is
  restored silently.
- The phone Day stops sheet is not rendered without a trip. With a trip whose selected day has no stops it
  opens collapsed to its handle plus the line "Nothing planned for this day yet."
- Wide desktop keeps its existing rule of hiding the map area until a trip exists; tablet width shows the
  same basemap and hint without a button because the top bar switch already reaches Chat.

## Alternatives considered

- Keep the permission card but dismiss it by default on the phone: the card and its stored choice
  remain, and the question still arrives before the traveller has a reason to answer.
- Keep the placeholder card and only add a basemap behind it: three messages would still compete.

## Consequences

E2Es that waited for the location card no longer do. `phone-map-empty-hint` covers the states at 390x844
and 360x800 and saves screenshots and `summary.json`.

## Sources

- Spec #730, ticket #737 (TP-117); the [location prompt note](2026-09-24-location-prompt-and-itinerary-map.md).
