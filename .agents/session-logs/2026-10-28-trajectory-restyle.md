---
date: 2026-10-28
author: Claude
branch: feature/TP-137-trajectory-restyle
pr: none
area: apps/web, docs
contract-impact: none
---

# Restyle the Trajectory view with the glass tokens (TP-137, #763)

## What changed

- `components/trajectory/*.module.css`, `TrajectoryTab.tsx`, `TrajectoryToolbar.tsx`, `TrajectoryTable.tsx`: the view switch, toolbar and inspector are inset glass surfaces; rows, timeline and ledger stay solid; secondary text meets AA.
- `app/styles/chat.css`: the Trajectory box is a solid rounded surface.
- `trajectory-restyle` E2E script and failure inventory with before and after screenshots; `docs/workspace-ui` (en, zh); an Agent Note.

## Why

Joey found the Trajectory plain. Glass reuse keeps the reduced-transparency fallback in `glass.css`. `--text-dim` was 4.49:1 on glass, so the view mixes its own quiet colour.

## Validation

`trajectory-restyle --prod`: before run red on the glass and contrast checks, after run green. Screenshots in `output/playwright/trajectory-restyle/{before,after}/`.

## Notes for the next person

Phone Chinese and English were checked at 390 px only in the browser, not on a device.
