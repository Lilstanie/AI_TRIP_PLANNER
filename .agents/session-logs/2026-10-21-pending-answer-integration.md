---
date: 2026-10-21
author: Codex
branch: fix/pr448-submission-recovery
pr: 448
area: apps/web, docs
contract-impact: none
---

# Verify pending answer recovery against the integrated main branch

## What changed

- Integrate main through 577202a719af91d98abe2cfeeac23ab10e7c8e52.
- Review progress validation, restored drafts, request locking and Stop cancellation together.
- Preserve existing cancellation and validation guards; no additional abstraction was needed.

## Validation

- Tested clean revision 450e61efd05b53c870c0d5b9da912e2819fe89e5, tree af20bb15ba5c3c75aa579ee5803e678ef05551c4.
- CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e pending-ask-refresh: 65/65, exit 0; runner 2026-10-20T12-33-26-427Z.json.
- Browser coverage: English 375x812 and 1440x1000, Chinese 390x844; reload, malformed progress, retry, skip, Stop, late-response rejection and no overflow/errors.
- pnpm --filter @trip/web typecheck: exit 0 on the integrated tree.
- Additional pre-push regression checks are quoted with their actual results in the PR.
- Prior implementation checks included 642 web tests, build, lint and repository guards; they are historical evidence rather than a new integrated build claim.
- Environment: Node 26.8.1, pnpm 9.15, Chrome 155; intercepted API responses, not live-model acceptance.

## Notes for the next person

Submission guards protect draft ownership. Removing them requires keeping cancellation and stale-response behavior intact.
