---
date: 2026-10-26
author: Codex
branch: feature/TP-101-phone-editing
pr: none
area: apps/web, docs
contract-impact: none
---

# Preserve phone edits and confirm destructive closes

## What changed

- `WorkspaceView`, `TripFactChips`, `Drawer` and `useDiscardChanges` retain phone drafts across tabs and confirm changed closes.
- `StopForms`, `TimelineStop` and `StopEditSurface` use bottom sheets for focused edits and a full page for complex Stop details.
- Phone edit failures retain values and show actionable notices; focus returns after Continue, Discard and responsive crossings.
- `phone-editing.e2e.mjs` and its failure inventory cover all dismissal paths, EN/ZH, focus, keyboard contraction and boundaries.
- Workspace and design docs describe the shipped phone edit behavior and their physical-device limits.

## Why

Phone tab transitions previously disposed of unsaved fields without warning. Stop and Brief editors
also used inconsistent surfaces, which made dense details difficult to recover around an open
keyboard or leave safely.

## Validation

- `pnpm --filter @trip/web exec vitest run tests/components/preferences/TripFactChips.test.tsx` — 21 passed.
- `pnpm --filter @trip/web e2e phone-editing` — 35 passed; `output/e2e/runner/2026-10-25T15-21-47-380Z.json`.
- `pnpm --filter @trip/web test` — 57 files and 642 tests passed.

## Notes for the next person

Browser fixtures validate visible behavior, focus and a simulated visual-viewport contraction. They do
not prove physical-keyboard behavior, installed safe areas or live providers.
