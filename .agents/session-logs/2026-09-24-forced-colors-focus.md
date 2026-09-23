---
date: 2026-09-24
author: Claude Code
branch: fix/forced-colors-focus
pr: 62
area: apps/web
contract-impact: none
---

# Keep the focus ring visible in forced-colors mode

## What changed

- `apps/web/app/styles/base.css`: the global `:focus-visible` rule now sets
  `outline: 2px solid transparent; outline-offset: 2px` instead of `outline: none`. The
  `box-shadow: var(--ring)` ring stays for normal mode.
- `apps/web/app/styles/composer.css`: `.composer:focus-within` gets the same transparent outline.
- `apps/web/app/styles/question.css`: `.question__custom-row:focus-within` and
  `.question__custom-block:focus-within` get the same transparent outline.

## Why

Forced-colors mode (Windows High Contrast) drops box shadows and flattens border and background
colours, so keyboard users there saw no focus at all. A transparent outline is invisible normally and
is painted in the system colour under forced colours. The composer and question frames suppress the
field's own ring and show focus by colour alone, so they needed the outline on the frame.

## Validation

- Playwright (Chromium, `emulateMedia({ forcedColors })`, the same CDP emulation as DevTools
  Rendering) at 1440×1000 and 390×844 against `pnpm --filter @trip/web dev`:
  - normal: focused button outline `rgba(0,0,0,0) solid 2px`, ring shadow unchanged; screenshots match
    the previous ring.
  - forced colours: shadow `none`, outline painted; composer outline `rgb(0,0,0) solid 2px`.
  - question frames (injected markup): transparent normally, painted under forced colours.
  - phone: `scrollWidth` 390 = viewport.
- Screenshots in `output/playwright/` (Git-ignored).
- `pnpm --filter @trip/web lint`, `pnpm verify:docs`, `pnpm verify:protected` and Prettier on the
  changed files: all pass.

## Notes for the next person

- The pressed mobile Chat/Map tab (`.topbar-views button[aria-pressed="true"]` in
  `workspace-layout.css`) overrides the ring's box-shadow with `--shadow-sm`, so in normal mode it
  has no visible focus ring. That predates this change; the outline now covers forced colours only.
- The `better-accessibility` skill's "Focus ring" bullet is not on `main` yet (it is uncommitted work
  on `docs/interface-skills`); update it there when that lands.
