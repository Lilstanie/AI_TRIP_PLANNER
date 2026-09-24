# Agent Note: Location question on open and an itinerary-first map

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The owner asked for four map changes, modelled on [Mindtrip](https://mindtrip.ai): ask for the
traveller's location when the page opens; connect a plan's stops in order on the map with an
animated line; move the planned places from a list over the bottom-left of the map into the Trip
drawer; and label markers with place names, with a press opening the place's details.

Two of these collide with earlier rules. The workspace promised that location is requested "only on
request", and browsers penalise a permission prompt that appears without a user gesture: Chrome
quiets or auto-blocks sites that ask on load, and a traveller who denies it once cannot be asked
again from the page. The design contract also lists photo markers as allowed, but each place photo
is a billed request and the [place photos note](2026-09-24-place-photos.md) requires a quota
counter before lists or markers multiply them.

## Decision

- **Ask in our words first.** When the workspace opens, `useUserLocation` shows `LocationPrompt` in
  the notices strip: why the location is wanted, Allow location and Not now. Only Allow location (or
  the map's Show my location) calls `navigator.geolocation`, so the browser prompt always follows a
  press. Not now is stored as `trip.locationPrompt = "dismissed"` in `localStorage` and the question
  does not return. After an Allow the browser still grants (Permissions API state `granted`), later
  visits show the position without asking; if the browser blocks location the question is skipped.
  Only the answer is stored. The position stays in memory, is never written into a plan, and leaves
  the browser only for Route from my location. Locating from the question does not pan the map, so
  it never undoes the trip framing; Show my location still pans.
- **Itinerary lines.** `lib/map/itinerary-route.ts` orders stops by day, then start time, then plan
  order, and draws one line per day. A leg uses a verified Google Routes polyline from the timeline
  editor when one exists for that exact pair of places, otherwise a straight segment; nothing calls
  Routes just to draw. The focused day (the selected stop's day, or every day with no selection)
  gets an `--accent` underlay plus dashed Symbol icons whose `offset` advances in one
  `requestAnimationFrame` loop capped near 30 frames a second. The pattern is Google's documented
  "Animating Symbols" technique (icons on a `Polyline` with a changing offset), written here from the
  API reference rather than copied. Reduced motion draws the dashes still and starts no loop.
- **Places in the drawer.** `TripPlaceList` heads the Overview tab with every activity by day in
  visiting order. Located stops are buttons that select the stop on the map; this list is the
  keyboard path to every marker, replacing the map overlay list.
- **Labelled markers.** A numbered badge sits on the place with a pill holding a category icon (from
  Places `primaryType`, added to the field mask) and the name. Labels truncate, hide below zoom 12
  except for the selected stop, and are decluttered when the map settles. Markers carry no photos.
- **Place popup.** The selected stop opens `PlacePreview` over the bottom-left of the map with a
  close button; Escape and a press on the map close it and return focus to the marker.

## Alternatives considered

**Call `navigator.geolocation` on load.** The literal reading of the request. Rejected: it breaks the
documented request-on-action rule, browsers suppress or permanently block prompts without a gesture,
and a first-time traveller sees a permission dialog before knowing why.

**A third-party animated-line component from the reference sites.** Aceternity UI's World Map draws
animated arcs in its own SVG with Framer Motion, which this project does not use, and none of the
listed sites offer a Google Maps polyline component. Google's own symbol animation fits the map
already in use with no dependency.

**Photo thumbnails on markers, as on Mindtrip.** Rejected for now: one billed image per marker
without the quota counter the place photos note requires.

**Keep the list on the map and add the drawer list.** Rejected by the owner's request; two lists of
the same stops also drift apart.

## Consequences

- The location question adds one stored key and one Permissions API query per open; nothing about
  the position is persisted.
- The dash animation costs one `Polyline.setOptions` per animated day per frame (about 30 a second)
  while the map is visible; browsers pause the loop in background tabs.
- `primaryType` sits in a lower Places billing tier than `rating`, so lookups cost the same.
- Straight segments are approximate. Verified Routes polylines appear only for legs the traveller
  verified in the timeline editor.
- Marker clustering with counts, as on Mindtrip, is not implemented; decluttering hides labels but
  keeps every badge.

## Sources

- Session log: [2026-09-24-map-itinerary-route](../../../session-logs/2026-09-24-map-itinerary-route.md)
- Google Maps JavaScript API, "Animating Symbols" sample:
  <https://developers.google.com/maps/documentation/javascript/examples/overlay-symbol-animate>
