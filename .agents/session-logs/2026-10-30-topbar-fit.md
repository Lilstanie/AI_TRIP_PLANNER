---
date: 2026-10-30
author: Claude Code
branch: feature/TP-186-topbar-fit
pr: none
area: apps/web, docs
contract-impact: none
---

# Desktop top bar controls no longer overlap

## What changed

- `app/styles/workspace-layout.css`:
  - 1041–1280 px container: columns `minmax(0, 1fr) minmax(0, auto) auto`, so the title column
    gives way and the trip fact chips keep their width. The old `auto` title column let a long title
    push the chips over Agent Team and Mock data.
  - 921–1040 px container: a `facts` row under the leading row. The chips named an area the template
    lacked, so the grid added an implicit column that squeezed the title to one letter.
  - `.topbar-leading .team-control` is `flex: none`, so Agent Team no longer wraps beside a long
    title above 1280 px.
- `tests/e2e/topbar-fit.e2e.mjs`, `topbar-fit.failures.md`, `docs/workspace-ui*.md`.

## Why

With the Trip open on a 1440 px window, the chips covered Agent Team and Mock data.

## Validation

- `topbar-fit.e2e.mjs` against dev (mock data), eight widths from 1100 to 1920 px: before 26/33
  (overlaps at 1366 and 1440, title 0–12 px at 1200 and 1280, Agent Team two lines at 1536 and 1680),
  after 33/33. Phone top bar at 390 px unchanged, no horizontal scroll.
- Web `typecheck`, `lint`, `check-ui-copy`, `verify:docs`, translation pairs,
  `verify:e2e-selectors`, `verify:e2e-artifacts`, Prettier.

## Limitations

- Above 1280 px the chips still scroll sideways when the title is long; that is the existing design.
