---
date: 2026-09-24
author: Claude Code (Opus 5.5, subagent)
branch: feature/mindtrip-preferences
pr: none
area: apps/web, docs
contract-impact: none
---

# Trip preferences move from a drawer to Mindtrip-style fact chips in the top bar

## What changed

- `components/preferences/TripFactChips.tsx`, `FactPopover.tsx`, `FactFields.tsx` and
  `lib/workspace/trip-facts.ts`: a chip per fact (destination, dates, travellers, budget,
  Preferences), each opening its own anchored editor; a bottom sheet at ≤520 px.
  `FiltersPanel` and the Preferences drawer are removed.
- `useWorkspaceController` keeps `openFact` instead of `preferencesOpen`; `submit(next)` in
  `useWorkspaceTransport` takes the chip's edit, returns whether it sent, and reports field errors.
- `.dialog` gets `margin: auto`: Tailwind's preflight had pinned native modal dialogs (the
  calendar, Saved trips, Review plan) to the top-left corner.
- Docs: `workspace-ui.md`, `ui-guidelines.md`, `architecture.md`, `class-diagram.md`, the
  better-accessibility skill, and a new
  [preference chips Agent Note](../notes/implemented/feature/2026-09-24-preference-chips.md).

## Why

The owner asked for Preferences to work like Mindtrip's. The Agent Note records what Mindtrip does,
why the editors anchor instead of opening centred, and why Update trip replans once a plan exists.

## Validation

- `pnpm --filter @trip/web test`: 33 files, 321 tests passed.
- `cd apps/web && npx tsc --noEmit`: passed. `pnpm --filter @trip/web lint`: no warnings or errors.
- `npx prettier --check` on the changed files: passed. `pnpm verify:docs`: notes, skills and links
  valid. `pnpm verify:protected`: rules hold relative to origin/main.
- Browser, dev server on port 3001 in mock mode, no planning messages sent: 1440×1000 light and
  dark, 1100 and 1000 wide, 390×844 light, 375×812 dark. Keyboard open, Save, Escape, Tab loop and
  focus return; Escape with the calendar open closes only the calendar; validation error on a
  negative budget; draft persisted to the catalog; plan state (restored saved trip) shows Update
  trip; `scrollWidth === innerWidth` at 390, 375, 1000 and 1440.

- Parent session, after rebasing onto #64: resolved conflicts in `Workspace.test.tsx` (kept
  `newChatButton()` with `openChip()`) and `workspace-ui.md` (kept both sections). The full web
  suite then passed: 33 files, 323 tests. Split into four commits; commits 1 and 2 were each checked
  alone (typecheck, lint, tests). Browser, mock mode: When opens with focus on the start date,
  Escape returns focus to its chip, and Who at 3 then Save shows "3 travellers" with no `/api/chat`
  request. At 390×844 dark it is a bottom sheet, with no sideways page scroll.

## Notes for the next person

- `class-1-spine.svg` and `class-5-with-use-cases.svg` were re-rendered with Mermaid 11 from
  `class-diagram.md`, and the combined map's label was edited, so no diagram names `FiltersPanel`.
- Update trip and Plan trip were not clicked in the browser because they start a paid planning
  request; component tests cover them.
