# B — Itinerary & transport reliability

## Scope and base

Built from main `2c1a49bd25e99974c772fe877ed311427a56c150` (PR #10). This increment preserves LangChain `createAgent`, `Specialist.invoke`, injected maps/booking/memory, the shared schemas and A's LangGraph workflow. The previous B mock remains in the original worktree; it was not used to overwrite the new architecture.

Other branches were inspected: `feature/interactive-trip-map` owns a larger coordinate/map contract; `feature/stage-5-3-memory-hitl` contains further shared and workflow changes. Neither is merged here. This PR-sized increment is confined to B source/test directories plus these docs.

## Behavior changes

| Trigger | Previous behavior | This increment |
| --- | --- | --- |
| Empty same-day route | Sum empty array as zero minutes | Explicit geography conflict |
| Route service fails | Abort whole itinerary/transport | Keep available evidence, report unresolved route |
| Trip-day 3 transfer | Query using arrival date | Query date = start + day - 1 |
| Impossible date | Transport accepted normalized calendar date | Validate ISO date before tools |
| Adjacent activities | Route time only | Route time plus 15-minute buffer |
| No place candidates | Invent a Central destination fallback | Return no activities and an evidence conflict |
| One places query fails | Reject whole proposal | Use remaining grounded candidates, label partial evidence |
| A requests a blocked time window | Deterministic fallback stayed at 13:00 | Shift after the blocked window with a buffer, recheck travel |
| No daytime slot | Potentially repeated unchanged proposal | Keep explicit unresolved conflict |
| Schema-valid model rewrites fare/route | Model output could overwrite calculator | Calculator proposal is authoritative, including conflicts |
| Fare unavailable | `0` appeared as a free route | Omit item cost, label incomplete known estimate, report conflict |
| OSRM driving estimate | Used to validate public transport | Label driving-only; B rejects it as transit evidence |
| Provider omits duration | Manufacture a one-minute route | Reject invalid response |

## Boundaries deliberately preserved

- Dates are **end-exclusive**, matching latest main (overnight interval count). Same-day trips remain unsupported; this is different from the old B mock's inclusive dates.
- Flight prices already represent the whole group. Route amounts retain the existing adapter/group-total convention; there is no new multiplication by groupSize. The current MapsPort has no passenger or fare-basis field. A future per-person provider needs an agreed port change to normalize accurately.
- Route arrays mean consecutive legs. They are not alternatives.
- Route/day metadata is still limited: Google receives a date with the existing fixed 09:00 UTC departure. The port cannot represent the actual local departure time or timezone. This increment fixes wrong days, not timezone-aware transit timetables.
- No public contract changes. `fare unavailable` and OSRM note recognition are temporary compatibility checks for existing adapters. Structured fare status, mode=driving, source freshness and opening intervals should be agreed with A instead of encoded into more prose conventions.
- OSRM live road routing is not a substitute for public transit. Its estimates remain exposed by the adapter for compatibility, but B emits a conflict rather than using them for transit planning. Live Google routing can supply transit time; returned fares remain unavailable. Default mocks remain usable offline.
- Opening hours, holidays and live admissions are **not implemented**. Fallback activity costs are labelled planning allowances, not verified ticket prices.
- Budget revisions still rely on the existing model/fallback and A's global cost recheck. We do not claim an exact saving when RevisionRequest does not include the previous proposal or a numeric target. No fake discounts.
- Shared activity/transport scheduling and arbitrary natural-language revision constraints remain integration work. Only A's current `on day N keep clear of HH:MM-HH:MM` grammar is deterministically handled. No claim to solve every constraint or globally optimal routes.

## Verification and demo

Use Node >=22 and the repository's pnpm 9.15.0, then:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm --filter @trip/web exec next dev -p 3102
```

No API key is necessary for offline tests; provider tests stub fetch and model-boundary tests stub model behavior. The LangGraph integration tests run the real graph with injected specialists/tools. These are distinct from a live paid model/API test, which has not been run.

Focused B tests:

```sh
pnpm --filter @trip/agents exec vitest run src/itinerary src/transport
pnpm --filter @trip/tools exec vitest run src/maps.test.ts
```

Demonstrate `workflow.integration.test.ts`: the transport fixture blocks day 1 12:00–14:00; fallback itinerary moves from 13:00–16:00 to 14:15–17:15 and converges in round 2. With no place evidence, the same real graph ends in round 3 with `needs_you` and escalation.

## Next bounded increment

1. Agree structured departure time/timezone, route mode and fare-status fields with A before claiming live-route correctness.
2. Coordinate itinerary and transport against one destination/activity schedule; compare the teammate branches before adopting their shared structures.
3. Add verified opening-hour constraints only after selecting a source and freshness policy. Unknown remains unknown.
4. Bring interface changes through review; do not replace the teammate's map work.
