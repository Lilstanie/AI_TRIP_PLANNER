# Agent Note: a priced item names the selection it came from

Status: implemented
Owner: A (@Lilstanie)

## Problem

A section's `items` and its `stays` / `flights` are built from the same list, in the same order, and
nothing recorded which went with which. That was fine while nothing could change a choice. The
moment the traveller can swap a fare, the editor has to find the item that carries its cost, and the
only handles available were the day and the location string.

Both are wrong in cases the planner already produces. A day can carry a flight *and* a ground hop,
so matching on day picks whichever comes first. Matching on `location` compares prose that the
agents are free to reword.

The same change needed the item's `detail` rewritten, because a swapped fare leaves a sentence
describing the hotel or airline the traveller just replaced. The agents own that wording.

## Decision

`ProposalItem.selectionId?: string` names the `StaySelection` or `FlightSelection` the item was
priced from. The accommodation agent sets `stay-<day>` and the transport agent sets
`flight-<legIndex>`, matching the ids they already give those selections.

The sentences move to `@trip/shared/describe`: `describeStayChoice`, `describeFlightChoice` and
`stayChoiceCost`. Both agents and `apps/web/lib/trip/trip-edit.ts` call them, so a swapped choice
reads exactly like a planned one. `@trip/shared` is the only package all three already depend on;
`apps/web` deliberately does not depend on `@trip/agents`.

Ways this can fail, written before the code and each handled: an item whose selection was removed
(the edit is rejected, naming the choice as gone); a selection whose candidate id is unknown (same);
two items claiming one selection (impossible — the agents derive both from one list); an older plan
with no `selectionId` (optional, so it parses, and the edit is rejected rather than guessing); a
section that has items but no selections (rejected before anything is changed).

## Alternatives considered

**Match the item by day.** No contract change, and correct for accommodation, which has one stay per
segment. It silently picks the wrong item on a day with both a flight and a ground hop, which the
inter-city promotion produces routinely.

**Match by the `location` string.** Also no contract change, but it makes traveller-facing prose
load-bearing: rewording "Melbourne → Sydney" would break pricing.

**Rebuild the sentence in the web layer.** Avoids touching `packages/shared`, but the same purchase
would then read in two voices depending on whether the traveller had changed it.

## Consequences

- An item without `selectionId` cannot be re-priced by the editor. Plans created before this change
  fall into that case and have to be replanned to become editable.
- The agents' wording is now shared code. Changing a sentence changes it for both the planner and
  the editor, which is the point, but it also means the two can no longer be tuned separately.
