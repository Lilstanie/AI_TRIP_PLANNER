---
date: 2026-09-25
author: Claude Code (Opus 5.5)
branch: feature/apple-style-ui
pr: none
area: apps/web, docs
contract-impact: none
---

# Liquid Glass (iOS 26) restyle of the workspace, with smooth region transitions

## What changed

- `app/styles/tokens.css`: Apple palette, system type, larger radii, glass and motion tokens;
  new `glass.css` (material on every floating layer) and `motion.css` (view transitions,
  segmented thumbs, sheet/drawer/backdrop enter and exit). `app/layout.tsx` drops Fraunces.
- `components/ui/motion.ts`: `viewTransition`, `usePresence`, `useSegmentIndicator`; wired into
  `WorkspaceView`, `TripsPage`, `TripPanel`, `TripFactChips` and `FactPopover`.
- `tests/e2e/liquid-glass.e2e.mjs`: repeatable walk of every surface, light and dark, desktop and
  phone; screenshots and a video under `output/playwright/liquid-glass/`.
- Docs: new [Liquid Glass Agent Note](../notes/implemented/feature/2026-09-25-liquid-glass-workspace.md)
  supersedes and archives the control-layer glass note; `docs/design/ui-guidelines.md`,
  `docs/workspace-ui.md` and the better-ui skill and glass recipe updated.

## Why

The owner asked for Apple's latest design, Liquid Glass specifically, and smoother switching
between parts of the app. The helpers are no-ops under reduced motion and in jsdom, so the
existing unit tests keep their synchronous close/unmount expectations.

## Validation

- `pnpm --filter @trip/web typecheck` (via `tsc --noEmit`): pass.
- `pnpm --filter @trip/web test`: 37 files, 370 tests pass. `pnpm --filter @trip/web lint`: clean.
- `CHANNEL=chrome node apps/web/tests/e2e/liquid-glass.e2e.mjs`: 16/16 checks pass (glass applied,
  sheets close, segmented thumb placed, backdrop leaves, no side scroll, no console errors).
- `pnpm verify:docs`, `pnpm verify:protected`: pass.

## Notes for the next person

- No real map tiles in this environment, so glass over live map tiles was not contrast-checked;
  do it with a Maps key, and check map panning smoothness at phone width.
- The E2E script needs Playwright (`PLAYWRIGHT=` path) and runs against a running dev server.
