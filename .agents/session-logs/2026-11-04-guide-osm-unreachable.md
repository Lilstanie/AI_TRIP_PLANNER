---
date: 2026-11-04
author: Claude Code
branch: fix/guide-osm-unreachable
pr: none
area: packages/agents, packages/orchestrator, docs
contract-impact: none
---

# The destination guide degrades instead of failing when OpenStreetMap is unreachable

## What changed

- `packages/agents/src/destination-guide/index.ts`: each sight and museum lookup is caught, logged and
  recorded as `Place provider unavailable for <category> in <city>`; an abort still stops inside the
  catch. Any failed lookup sets the guide source to `unavailable` / `Maps provider`.
- `packages/orchestrator/tests/guide-osm-unreachable.e2e.test.ts` and its `.failures.md`, written
  before the fix: the real tool gateway in live OSM mode against a closed local port, with the
  itinerary and guide specialists, plus an abort case. Writes `output/e2e/guide-osm-unreachable/plan.json`.
- `docs/architecture.md` and `docs/architecture.zh.md`: the guide's place-lookup degradation.

## Why

A rejected place lookup escaped the guide and the workflow rethrew it, failing the whole plan, while
the itinerary already degraded. The missing-place source wins over `fallback` and the weather source,
because missing place evidence is what the traveller needs to see. On `main` the accommodation
specialist fails first in this setup (fixed in PR #962), so the reproduction runs at orchestrator
level instead of through `/api/chat`. Port 9 is not used: undici refuses it as a "bad port", which
does not model a refused connection.

## Validation

- `REDGREEN_RUN="pnpm --filter @trip/orchestrator exec vitest run" node scripts/redgreen.mjs guide-osm-unreachable -- packages/agents/src/destination-guide/index.ts`:
  before exit 1 (2 failed: `agent_failed` for destination-guide; `TypeError: fetch failed` instead of
  `AbortError`), after exit 0 (2 passed).
- `pnpm --filter @trip/agents test` 213 passed; `pnpm --filter @trip/orchestrator test` 449 passed.
- `pnpm --filter @trip/agents --filter @trip/orchestrator typecheck` and eslint on the changed files: clean.

## Notes for the next person

Once PR #962 merges, a browser E2E through `/api/chat` with stubbed OSM can cover the full flow.
