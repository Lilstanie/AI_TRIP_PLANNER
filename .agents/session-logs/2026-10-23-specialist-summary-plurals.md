---
date: 2026-10-23
author: Claude Code
branch: fix/english-summary-plurals
pr: none
area: packages/agents, packages/orchestrator, apps/web tests, docs
contract-impact: none
---

# English specialist copy counts without "(s)"

## What changed

- `packages/agents/src/summary-copy.ts` exports the `plural()` helper from #601 and uses it for the
  transport and dining-candidate summaries (#604).
- `packages/agents/src/accommodation/index.ts`, `dining/index.ts` and `transport/index.ts` use it for
  the room allocation, compared-options, planning-day and unpriced-leg lines.
- `packages/orchestrator/src/progress-copy.ts`: "revision request(s)" counts naturally.
- Unit tests for the old copy, `chinese-party-size` ("12 travellers") and the new
  `specialist-summary-plurals` E2E with its failure inventory (written first).
- `docs/workspace-ui.md` and its Chinese pair.

## Validation

- `node scripts/redgreen.mjs specialist-summary-plurals -- <the five source files>`: before, exit 1
  with 4/10 ok; after, exit 0 with 10/10 ok.
- `chinese-party-size` and `stay-summary-plural` pass; agents 144 and orchestrator 296 unit tests pass.

## Known limitation

`packages/shared/src/describe.ts` still writes "room(s) × night(s)" in price details. It is a shared
contract and needs its own Agent Note, so it is left for a separate change. The SerpApi fare note
("passenger(s)") and the Agent Lab fixtures are unchanged.
