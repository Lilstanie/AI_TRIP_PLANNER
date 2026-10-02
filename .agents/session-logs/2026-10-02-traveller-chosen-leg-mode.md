---
date: 2026-10-02
author: Claude Opus 5 (with A / @Lilstanie)
branch: feature/traveller-chosen-leg-mode
pr: none
area: packages/shared, packages/agents, packages/orchestrator, apps/web
contract-impact: packages/shared
---

# The traveller can choose how a hop is made

## What changed

- `packages/shared`: `LegModeChoice` (`{from, to, mode}`), `TripBrief.legModes`, the same on
  `PartialTripBrief`. `TravelModes` moved above `TripBrief` — a Zod schema is a value, so it could
  not be named from further up the file.
- `packages/agents/src/transport/legs.ts`: `ModePreference` is now `TravelMode`, not `LegMode`;
  `chosenModeFor` matches a hop by endpoints, case- and space-insensitively; `JourneyLeg.chosenMode`
  carries the specific mode.
- `packages/agents/src/transport/index.ts`: the choice reaches `journeyLegs`; a chosen ground mode
  is exempt from flight promotion; `layOutHop` schedules from the chosen mode, preferring the
  provider's own route when that is already it; an unmeetable choice goes to the summary and
  assumptions, never the conflict list.
- `packages/orchestrator`: `BriefPatchSchema.legModes`, a `travelModeChoices` field on the
  coordinator's update tool, the merge, and prompt lines for the coordinator and supervisor.
- `apps/web`: `Draft.legModes` through `draftFor`/`parseDraft`/`knownFromDraft`/the known-merge, and
  a removable row per choice in `PreferenceList`.
- `apps/web/tests/e2e/leg-mode-choice.e2e.mjs`, and `docs/development.md` describing it.
- Agent Note `2026-10-02-traveller-chosen-leg-mode` (failure modes listed before the code).

## Why

`legMode`'s `preference` parameter had zero callers for ten days, and was the wrong width:
`"flight" | "ground"` cannot express "train, not the bus". Choices are keyed by endpoints because a
leg index silently re-points at a different hop as soon as a destination is added.

The E2E caught two defects unit tests would have missed. An unmeetable choice first went through
the conflict channel, where `detectConflicts` turned it into "make the route geographically
feasible" — a revision transport could only answer identically, the exact trap #116 removed for
fares. And scheduling from `routeOptions` bypassed the inter-city rail fare that only `route()`
carries (#83), so choosing the train dropped transport from A$1680 to A$0.00 and looked like a saving.

## Validation

`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm verify:docs`, `pnpm verify:protected` clean.
`pnpm test` 770/770 (no unit tests added; see the testing policy). E2E `DATA_MODE=mock`: 4/4
deterministic scenarios pass, the conversational one reports `skip` — **this machine has no model
key, so the chat path is wired but unverified.** Not run against live providers.

## Notes for the next person

- Verify `said-in-chat` once a model key is configured; that is the only path a traveller actually
  uses today.
- A chosen mode that cannot fit a planning day is still a conflict, deliberately: the hop is dropped
  and the plan has a gap. Unlike the unavailable case, that is not merely informational.
- A per-hop control in the Getting around section can now write to `legModes`; `/api/trip/preview-edit`
  cannot price a flight, so a switch to flying still needs a replan.
