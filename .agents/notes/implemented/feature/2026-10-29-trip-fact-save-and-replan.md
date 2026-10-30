# Agent Note: Trip fact editors save without replanning

Status: implemented
Owner: spec #788, ticket #793

## Problem

The [preference chips note](2026-09-24-preference-chips.md) made Update trip (later Replan trip) the
only action in a fact editor once a Plan existed. Spec #788 asks for Trip home fact entries where
saving a destination, date range, traveller count or budget is distinct from replanning, and where a
cancelled edit leaves the stored Trip unchanged.

## Decision

- Trip home renders `TripFactChips` for destination, dates, travellers and budget. Trip preferences
  keeps its own action card and drawer, so the preference list is edited separately.
- Opening a home fact activates that Trip through `previewTrip`, then opens the existing fact editor
  through the layout reducer while the page stays `home`.
- Every fact editor has Save. Save validates with `factErrors`, merges only the fields the editor
  changed onto the latest draft, persists through `session.saveFacts` and leaves the Plan unchanged.
- With a Plan, the editor also has Replan trip, which applies the same merge and calls
  `session.planWith`. A plain chat message still carries `plan.brief`; a saved draft reaches the
  planner only through an explicit Replan or Plan trip.
- Budget edits use the Trip's effective currency through `LocaleProvider`, keep `budgetSource` and
  store the planning amount in AUD.

## Alternatives considered

- **Keep Replan as the only action once a Plan exists.** Rejected by #788: every fact change would
  become a paid planning request and the traveller could not save a fact for later.
- **Add a separate Trip home fact model.** Rejected by #788: the draft, Plan, snapshots and editors
  already own these facts.

## Consequences

- After Save, the chips can show a draft value that the current Plan was not built from until the
  traveller replans. Save and Replan are visibly separate controls.
- Merging changed fields prevents an open editor from overwriting another fact saved meanwhile.
