# Agent Note: The conversation updates trip preferences and the trip's scope

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The owner reported two failures from a Shanghai chat. First, preferences stated in chat ("no dietary
requirements", "a relaxed pace") never reached Trip preferences, so the planner forgot them. Second,
after being told that flights were arranged and the hotel was booked, the assistant kept asking about
flights and the plan still priced flights and compared hotels. `TripBrief` had nowhere to record that
a part of the trip is out of scope, so every replan restored it. The
[trip preference list note](2026-09-24-trip-preference-list.md) had also decided that the coordinator
should not record preferences it hears in chat.

## Decision

This note supersedes that one decision in the trip preference list note. Its other decisions stand.

- `TripBrief` and `PartialTripBrief` gain three optional fields in `packages/shared/src/contracts.ts`
  and `chat.ts`:
  - `learnedPreferences`: a `TripPreferences` list.
  - `excludeFlights`: a boolean.
  - `bookedStay`: a `BookedStay`, which is `name` (up to 160 characters) and an optional `note`
    (up to 300).

  The change is additive, and stored briefs and plans still parse.
- The coordinator's `update_trip_brief` tool sets these fields. `learnedPreferences` replaces the
  whole list each time; the list is trimmed, deduplicated and capped at `MAX_TRIP_PREFERENCES`. The
  traveller's own `preferences` stay out of the model's reach, so what they typed and what was
  learned remain distinct.
- Once `excludeFlights` or `bookedStay` is set, the coordinator prompt forbids asking about flights
  or other stays.
- Specialists see one list. `specialistBrief` in `packages/orchestrator/src/supervisor.ts` appends
  the learned entries to the traveller's own, deduplicates them and caps the result. The stored brief
  keeps the two lists apart.
- **Transport:** with `excludeFlights`, it skips flight search. Each flown hop becomes an unpriced
  "arranged by you" item, raises no fare conflict and offers no flight candidates. Ground hops are
  still planned.
- **Accommodation:** with `bookedStay`, it returns that stay as one unpriced item, with no search, no
  candidates and `floorCost` 0. The supervisor may reason that a booked stay needs no specialist, so
  `dispatchWithSupervisor` runs the accommodation specialist directly when it was skipped.
- **Web:** the draft carries all three fields through `draftFor`, `parseDraft`, `knownFromDraft` and
  `draftWithKnown`. Trip preferences lists them under "Learned from your chats". The traveller can
  remove an entry there but not edit it.

## Alternatives considered

- **Merge learned entries into `preferences`.** Rejected: the traveller could not tell their own
  words from the model's paraphrase, which was the original reason for keeping the list model-free.
- **Only a prompt rule, with no brief field.** Rejected: the rule lasts one turn, while the specialists
  replan from the brief every time.
- **Price the booked hotel from a search.** Rejected: the traveller has already paid a price the
  planner cannot know, and a search result would show a number that is not theirs.

## Consequences

- A plan with `excludeFlights` or `bookedStay` understates the trip's real cost. The items and
  summaries say "not priced" so the total is not read as complete.
- A booked stay is one item on day 1 for the whole trip, even when the trip visits several cities.
- Whether a wish is learned depends on the coordinator model. The
  `apps/web/tests/e2e/conversation-scope.e2e.mjs` run checks it against the live model.

## Sources

The owner's feedback in `docs/problem.md` (local, uncommitted) and the
[session log](../../../session-logs/2026-09-27-conversation-scope.md).
