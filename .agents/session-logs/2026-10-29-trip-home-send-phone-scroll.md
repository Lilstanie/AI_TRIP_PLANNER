---
date: 2026-10-29
author: Codex
branch: feature/TP-152-trip-home-send
pr: 782
area: apps/web, docs, .agents
contract-impact: none
---

# Keep the first-send Chat visible on phones

## What changed

- `WorkspaceView` scrolls the newly opened Trip-home Chat into view on phones before focusing its
  composer.
- `trip-home-send.e2e.mjs` now checks the post-send Chat and message viewport, natural scroll owner,
  pointer scrolling, visible composer, keyboard focus and typed input at phone widths.
- Updated the Trip-home action docs pair, failure inventory and Agent Note.

## Why

The post-send focus used `preventScroll`, leaving the focused composer below a 390×700 viewport at
the Trip-home scroll position. Counting the user message and forcing one programmatic scroll did not
prove that a traveler could reach or operate the new Chat.

## Validation

- `pnpm --filter @trip/web e2e run trip-home-send` → failed before the fix at
  `output/e2e/local-test-cli/2026-10-29T12-55-47-009Z-49648-9e9rb4/`
- `pnpm --filter @trip/web e2e run trip-home-send` → passed after the fix at
  `output/e2e/local-test-cli/2026-10-29T12-56-51-558Z-50294-du67l5/`

## Notes for the next person

The phone check uses real pointer-wheel input and then focuses and types into the visible composer.
Physical touch, on-screen keyboard and live-provider behavior remain separate evidence.
