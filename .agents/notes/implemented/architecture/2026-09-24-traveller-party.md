# Agent Note: The brief carries who is travelling, not only how many

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The Who editor now counts adults, children, infants, seniors and pets separately, but `TripBrief`
had only `groupSize`. The planner therefore could not know a trip included a toddler, an elderly
parent or a dog, and would happily propose late nights, stair-heavy walks or stays that refuse
pets. The repository owner asked for that limit to be removed.

## Decision

`packages/shared/src/contracts.ts` adds an optional `TravellerParty`
(`{ adults, children, infants, seniors, pets }`, integers 0–99) as `TripBrief.party`, and
`PartialTripBrief.party` in `chat.ts`, with `partyPeople(party)` for the people total.

- `groupSize` stays required and authoritative: every cost (dining per person, rooms, passengers)
  still uses it. `party` only describes who those people are and adds pets, who are never in
  `groupSize`.
- The schema does not require the two to agree, because the chat can learn a new head count after
  the steppers were used. Instead the web only sends a party whose people equal `groupSize`
  (`statedParty` in `apps/web/lib/workspace/workspace.ts`), drops a stale one when chat changes the
  count (`draftWithKnown`), and every specialist's shared rule (`TRAVELLER_PREFERENCES_RULE`) says
  to trust `groupSize` and ignore a party that does not add up.
- Specialists that read the whole brief through their evidence tool (itinerary, dining, destination
  guide) receive `party` with it; transport and accommodation add it to the brief they send. The
  chat coordinator is told not to re-ask what `knownSoFar.party` already says.

Additive and optional: stored briefs, catalogs and API clients without `party` are unchanged.

## Alternatives considered

- **Write the breakdown into `brief.preferences` as text.** Rejected: it would use up the
  traveller's own twelve preference slots with generated text they never wrote and could delete.
- **Make `groupSize` include pets, or derive it from `party`.** Rejected: every agent's arithmetic
  treats `groupSize` as people, and briefs without a party must keep working.
- **Require `party` to add up to `groupSize` in the schema.** Rejected: a later chat answer ("we're
  three now") would make an otherwise valid brief fail to parse.

## Consequences

- Suitability for children, seniors and pets is a request to the models, not verified: no provider
  here filters stays or venues by pet policy or accessibility, so specialists are told to say when
  they cannot confirm it.
- Children and infants are still costed as full travellers in `groupSize`.
