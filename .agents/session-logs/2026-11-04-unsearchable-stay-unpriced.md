---
date: 2026-11-04
author: Claude Code
branch: fix/unsearchable-stay
pr: 962 (Jira TP-373)
area: packages/agents, packages/shared, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# An unsearchable stay leaves the nights unpriced instead of failing the plan

## What changed

- `packages/agents/src/accommodation/index.ts`: a failed or empty stay search per city becomes an
  unpriced hotel item, source `unavailable` and a `stayUnavailable`/`stayNoMatch` conflict; priced
  cities keep their stays; the model tool lists `unpricedStays`.
- `packages/shared/src/plan-issues.ts`: the two new plan issues (en + zh).
- `apps/web/lib/trip/{open-items,conflicts,calendar}.ts`, `OpenItemsBadge.tsx`: "Unpriced stay" in To
  check, a localized budget-card notice, calendar stay bars over every night; the dead "No valid stays"
  branch in `app/api/chat/route.ts` and its message key are gone.
- Agent Lab `provider-empty-result` is now `degraded` (`fault-profiles.ts`, `fault-outcome.ts`, both
  Agent Lab E2Es, the orchestrator and route tests).
- New `apps/web/tests/e2e/stay-unavailable.e2e.mjs` with its failure inventory; docs and Agent Notes.

## Why

The owner chose unpriced nights in To check with source `unavailable`, which reverses
[the archived note](../notes/archived/bug-fix/2026-10-14-serpapi-osm-stay-failure.md); see
[the new decision](../notes/implemented/bug-fix/2026-11-04-unsearchable-stay-unpriced.md).

## Validation

- Reproduced on `main`: live dev server, `/api/chat` streamed `agent_failed` for accommodation and the
  error "Unable to update this trip"; log `Unsupported booking provider: osm`.
- `node scripts/redgreen.mjs stay-unavailable -- <10 source paths>`: before (origin/main) exit 1,
  2/5 ok; after exit 0, 19/19 ok.
- `pnpm typecheck`, `pnpm lint`: pass. Tests: shared 58, agents 213, orchestrator 437, tools 173,
  web 683, all pass.
- `pnpm verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`,
  `verify:e2e-artifacts`, `check-file-length`, `check-ui-copy`: pass.

## Notes for the next person

- With OSM itself unreachable, the destination guide still fails the plan (`overpass.ts` fetch
  error in `destination-guide/index.ts`); separate bug, not fixed here.
- `placeConflicts` splits reasons on `"; "`, so `flightUnavailable` shows as two budget-card lines.
- An unpriced stay keeps a conflict, so accommodation re-searches in each revision round.
