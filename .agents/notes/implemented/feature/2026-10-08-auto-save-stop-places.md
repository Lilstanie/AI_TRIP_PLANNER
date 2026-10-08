# Agent Note: Save the map's place for each stop automatically

Status: implemented
Owner: spec #233, ticket #236

## Problem

When the map finds a stop's place by name but the stop has no saved place, the traveller must press
"Use this place" in the stop editor. The stop shows "Map match · not confirmed" until then, and the
routes for its day cannot be checked. Spec #233 removes confirmations; this confirmation is one more.
The immediate place edit from #235 already saves a place without a review step, so the map's match
can be saved through it.

## Decision

When the map locates a stop by name and the stop has no saved place, the workspace saves that place on
the stop through `POST /api/trip/preview-edit` with a `place` operation, once per stop. The server's
accepted plan is applied at once, as for any immediate edit. The "Map match · not confirmed" badge and
the "Use this place" box are removed.

A stop the map cannot find shows "Not found on the map" and its search stays open; picking a result
saves it through the same path. A stop whose lookup failed for a retryable reason is not saved and is
retried by the map's existing "Retry places".

Auto-saves run one at a time, and only while the workspace is not busy with chat or another edit. The
runner lives in the workspace, not in the timeline, so a trip saves its places whether or not the Trip
timeline tab is open.

## Failure modes

| #   | Situation                                                          | Behaviour                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The map matches the wrong namesake (same name, another place)      | Saved as matched. Nothing in the app can tell a namesake from the right place. The stop editor shows the matched name, address and a Google Maps link, and "Replace with another place" replaces it. Accepted.                           |
| 2   | A lookup fails for a retryable reason (429, 5xx, network)          | Lookup status `unavailable`. Nothing is saved. "Retry places" re-runs the lookup; a located result is then auto-saved.                                                                                                                   |
| 3   | A save fails for a retryable reason (network, 5xx)                 | The stop is not saved, is marked as failed for this plan, and an error notice shows. It is not retried automatically, because a retry on every state change would loop while offline. The traveller saves it by picking a search result. |
| 4   | Two auto-saves race on the same plan version                       | Impossible by construction: at most one save is in flight, and the next stop is sent only after the previous one settles. The server's `baseVersion` check still guards staleness.                                                       |
| 5   | The server refuses the save (blocker such as a stop past midnight) | Not saved; the stop is marked as failed and the blocker notice shows. Not retried until the plan changes.                                                                                                                                |
| 6   | A newer plan from chat arrives while a save is in flight           | The in-flight save is aborted and its result discarded. Candidates are recomputed from the new plan. A stop and place already saved for an older plan are not re-sent for the same plan.                                                 |
| 7   | The traveller edits while an auto-save is in flight                | The traveller's edit aborts the auto-save, as any edit aborts an older request. Auto-saves wait while the timeline is busy and resume from the new plan.                                                                                 |
| 8   | Simulated mode, or no map key: the map finds no places             | No candidate, so no save request is sent. Stops show "Not found on the map" or "Place lookup failed"; nothing is saved and no error appears.                                                                                             |
| 9   | A stop already has a saved place                                   | Never auto-saved again. Only stops with no `placeId` are candidates.                                                                                                                                                                     |
| 10  | An auto-save lands after the traveller's last applied change       | The timeline's "Undo last change" step is cleared, as for any plan that did not come from the timeline's own apply. Accepted; the undo step would describe an older plan.                                                                |

## Alternatives considered

- Keep the "Use this place" box and only make it more prominent: rejected. The spec removes
  confirmations, and a confirmation the traveller has to find is still a confirmation.
- Save inside the timeline component: rejected. The timeline is mounted only on the Trip tab, so a trip
  planned from the map would keep its stops unsaved until the traveller opened the timeline.
- Send one batch of saves for all stops: rejected. The preview endpoint takes one operation and checks
  routes and budget for the whole plan each time, so a batch would need a new server contract
  (`packages/shared`), which this ticket does not approve.
- Retry failed saves on a timer: rejected. A timer keeps sending while the network is down, and the
  traveller can save the place through search at any time.

## Consequences

- Covered by the E2E `auto-save-places` script (21 checks, mock data mode, Places and preview endpoints
  stubbed at the browser boundary): a located stop is saved without a traveller action, a stop the map
  cannot find shows its search and saves a picked result, retryable failures are not saved, and the
  traveller can still replace a saved place.
- Not covered by E2E: a newer plan from chat cancelling pending saves (failure mode 6), and the real
  Google Places save path, because no map key is available in the repository's E2E environment.
- The "Use this place" E2E steps were replaced; the timeline and itinerary scripts pass in the same run.
  The timeline's route-check section is skipped without a map key, as before.
- A save sets `priceNeedsReview` on the stop, as the immediate place edit does today, so the "Price
  needs checking" tag appears on auto-saved stops until the price is checked.
- Each auto-save re-times the stop's day with walking routes (the workspace does not know the timeline's
  Walk / Public transport choice). A day the traveller checked by transit can shift when a place lands.
- A day with a stop the map cannot find keeps a travel-time conflict on the plan until that stop is
  saved. The server stores that gap as a conflict and does not refuse the other saves, because
  `apps/web/lib/trip/trip-edit.ts` turns non-move blockers into `conflictsWith`.
- `docs/workspace-ui.md` and its Chinese pair describe the behaviour.

## Supersession

Partly superseded by [One day view in the Trip drawer](2026-10-08-one-day-trip-view.md)
(#238). The stop editor described above is now the compact place card, and the "Use this place" box it
mentions is gone. The automatic save, the save states and "Retry places" are unchanged.
