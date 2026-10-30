---
date: 2026-10-29
author: Codex
branch: feature/TP-150-chat-generation
pr: none
area: apps/web, docs
contract-impact: none
---

# Chat-owned generation for #790 / TP-150

## What changed

- `useWorkspace.ts` owns in-memory turns by initiating Chat; same-Trip writer exclusion; Stop/failure/Retry; Plan conflict; applyEdit tripId guard.
- Storage publishes applied background Plans and preserves active Chat/Trip while saving initiating Chat results.
- Added `chat-generation` controlled browser E2E, failure inventory, Agent Note, workspace/CLI docs.

## Why

Visible-session abort on navigation could not keep background progress or protect newer Plan edits.

## Validation

- `LABEL=green-committed-candidate` and production `pnpm --filter @trip/web e2e run chat-generation`: 57/57, 18 requests.
- Evidence: `output/playwright/chat-generation/green-committed-candidate/`, `output/e2e/local-test-cli/2026-10-29T10-08-28-014Z-63132-ialxru/`.
- `pnpm --filter @trip/web build|typecheck|lint`, `verify:docs|pairs|protected|e2e-selectors|e2e-artifacts`, comment check vs `c18eeced`: pass.
- Spec/Standards/Ponytail recorded under `output/reviews/tp150/`.

## Notes for the next person

Integrated on `c18eeced`. Parent owns #794 C2/C3 home sync. No push/PR/issue close. Scratch: `apps/web/.next-tp150/`, `tsconfig.tp150.json`.

## Follow-up

- Replaced custom Plan fingerprint with `editVersion` comparison; derive turn restore fields from session state; Stop abort defers to `finish` cancelled path.
- Added Playwright `390×844` stopped/conflict path with `phone-stopped.png` / `phone-conflict.png`.
- Removed scratch `tsconfig.tp150.json`. Exact-HEAD chat-generation evidence after follow-up commit.
