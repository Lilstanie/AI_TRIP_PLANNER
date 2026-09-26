---
date: 2026-09-27
author: Claude Code
branch: feature/thinking-orb
pr: none
area: apps/web, docs
contract-impact: none
---

# Think row shows a thinking orb driven by real progress events

## What changed

- `apps/web/package.json`: `thinking-orbs` (via `pnpm --filter @trip/web add`), approved by the owner.
- `apps/web/components/chat/ThinkingOrbIcon.tsx`: `orbState` maps the latest progress event to an
  orb state; the orb is `aria-hidden`, 20 px, `theme="auto"`.
- `ThinkingProcess.tsx`: the orb replaces the static icon only while `busy`; `thinking.css` lets it
  overhang the 16 px slot so the row keeps its height.
- `apps/web/tests/e2e/thinking-orb.e2e.mjs` (new); `docs/workspace-ui.md` and its Chinese pair.

## Why

A libraries-dev review found the Think row the one place an effect fits the design contract: it
names real agent activity. Border beam, image reveal, voice, avatars, metal and gooey did not fit.

## Validation

- `pnpm --filter @trip/web test`: 371 passed; typecheck and lint clean.
- `CHANNEL=chrome node apps/web/tests/e2e/thinking-orb.e2e.mjs`: 24 checks pass at 1440 light,
  dark, 390 light and reduced motion — shows while planning, 20 px, paints, returns to the icon,
  row height 24 → 24, no console errors. Screenshots in `output/playwright/thinking-orb/`.
- `check-pairs.mjs`: 11 pairs checked after recording `docs/workspace-ui.md`.

## Notes for the next person

none
