---
date: 2026-10-27
author: Codex
branch: feature/TP-102-trip-workspace-redesign
pr: 726
area: apps/web, docs
contract-impact: none
---

# Preserve cancelled edits, recover drafts and retain Trip Undo

## What changed

- Chat transport confirms replacement before rewinding history; accepted Trip AI shortcuts open Conversation (#727 / TP-106).
- Trip drafts retain Idea scheduling and recover copyable fields when a Stop disappears (#728 / TP-107).
- Workspace owns one Undo per Trip across navigation and responsive remounts; new AI Plans invalidate it (#729 / TP-108).
- Background place saves and route checks rebase unaffected Undo fields instead of removing Undo or reverting enrichment.
- Dialog headings use unique IDs; tablet Trip height keeps recovery controls scrollable. Updated both workspace UI language versions.

## Validation

- Code/test head: `dd199c68`; production head: `9a2f2a3c`. No shared contract or API changes.
- `EVIDENCE_LABEL=final-reviewed CHANNEL=chrome pnpm --filter @trip/web e2e trip-review-recovery trip-drafts trip-workspace-layout phone-editing`: 14 + 34 + 42 + 39 passed, no skips.
- After changing only recovery waits, `EVIDENCE_LABEL=final-state-waits CHANNEL=chrome pnpm --filter @trip/web e2e trip-review-recovery`: 14/14 passed at `dd199c68`.
- `pnpm --filter @trip/web build`, `typecheck`, `test`, `lint`: passed; existing tests 642/642 across 57 files.
- `pnpm verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `format:check-changed origin/main` and UI-copy guard: passed.
- Independent Luna 6 high Spec and Standards review since `92feb5c5`: no remaining findings after background Undo and E2E wait fixes.
- Earlier red runs and fixture failures retained with final screenshots, logs and reports outside the checkout under `~/.codex/visualizations/2026/10/26/01a175f3-8f6a-70d0-b7b8-94d23cf40dc9/trip-redesign/review-fixes/`.
- Node 26.8.1, pnpm 9.15.0, Chrome 156; fixture chat/places, mock mode, blank provider/Maps/Clerk keys. Browser runs cover desktop/phone, responsive boundaries, EN/ZH, keyboard and actual 125%/150% zoom.

## Notes for the next person

- The missing canonical `trip:` prefix in an early fixture created duplicate records; that failure did not establish a product persistence defect.
- Live providers, hosted Clerk sign-in and physical-phone keyboard/safe-area behavior remain unverified.
- Raw Trip E2Es are local evidence; inspect CI's actual selected plan, workers, aggregate and artifacts separately on the pushed head.
- User requires explicit merge permission. Update PR evidence, verify current-head CI, run retro and stop without merging or deleting branches.
- Current behavior is documented in `docs/workspace-ui.md` and its Chinese pair; no additional document or Agent Note is needed.
