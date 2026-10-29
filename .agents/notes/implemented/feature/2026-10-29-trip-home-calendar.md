# Agent Note: Trip home Calendar reuses the itinerary projection

Status: implemented
Owner: spec #788, ticket #796

Superseded in part: [Trip home actions stay in place](2026-10-29-trip-home-actions.md) described the
Calendar as read-only. Activities now open the shared Itinerary editor.

## Problem

The Trip home Calendar replaced the global Trips calendar with an in-place drawer, but its read-only
month grid could not answer a traveller's main question: what happens each day in this Trip. It also
did not expose the existing timed and untimed itinerary regions, and browsing adjacent weeks could
show dates outside the Trip.

## Decision

- `apps/web/lib/trip/calendar.ts` projects Trip days through the existing `itineraryActivities` and
  `dayRows` domain functions. It does not create a second source of itinerary data.
- Calendar opens in Week view and offers Month view. Both views keep the workspace's selected Trip
  day. Previous and Next move only through the Trip's week or month starts, so the first and last
  periods disable their outward control and no off-Trip date is presented as a Trip date.
- Dates use UTC-based calendar arithmetic and formatting, keeping literal ISO Trip dates stable when
  the browser timezone changes.
- Timed activities show their actual ranges and overlap markers. Untimed activities, flights and
  stays appear in an All day region without invented times. Calendar entries are not drag handles.
- Clicking an activity opens its stable activity id and day in the shared Itinerary editor. Editing
  and Undo therefore update Itinerary, the conversation Trip, Calendar and the map through the
  existing Plan owner.
- Editing validates activity ids without requiring every scheduled activity to be timed. Routing,
  overlap checks, automatic time selection and Undo compare only timed activities.

## Alternatives considered

- Keep the read-only month grid and add navigation: it would satisfy neither activity discovery nor
  the requirement to enter the shared editor from Calendar.
- Build a separate calendar event model: it would repeat the itinerary's ordering, booking and
  day-placement rules.
- Fill first and last weeks with dates outside the Trip: it presents unavailable dates as actionable
  Trip days and contradicts the Trip boundary.
- Require every scheduled activity to have times before any edit: legitimate all-day activities
  block unrelated edits and Undo.

## Consequences

- Week and month navigation stop at the Trip bounds; the selected date may be retained while its
  button is outside the visible week.
- Untimed entries remain useful all-day information and never acquire a manufactured start time.
- Calendar depends on `apps/web/lib/trip/calendar.ts`, which reuses the timeline projection and has
  no separate persisted data.
- Browser E2E covers a cross-year Trip at desktop phone widths, English and Chinese, Sydney and
  America/Los_Angeles timezones, edit and Undo, overlap, all-day entries, navigation bounds and hit
  areas. It uses fixture-backed mock services rather than live providers.

## Sources

- [Issue #796](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/796)
- [Trip home actions](2026-10-29-trip-home-actions.md)
- [Trip home action rail](../../../../docs/design/trip-home-actions.md)
