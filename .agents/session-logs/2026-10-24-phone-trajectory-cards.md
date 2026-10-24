---
date: 2026-10-24
author: Claude Code
branch: feature/phone-trajectory-redesign
pr: pending
area: apps/web, docs
contract-impact: none
---

# Phone trajectory ledger as cards (#686)

## What changed

- `components/trajectory/TrajectoryView.tsx`: the root carries `data-trajectory-phone` at phone width and passes `phone` to the table.
- `components/trajectory/TrajectoryTable.tsx`, `trajectory-virtual-rows.ts`: phone rows use `PHONE_CONTENT_ROW_HEIGHT` (56 px) in the virtual list.
- `components/trajectory/TrajectoryTable.module.css`, `TrajectoryToolbar.module.css`: phone-only card rows, 44 px toolbar and inspector controls, 16 px search text.
- E2E: `trajectory-phone` checks toolbar sizes, search font size and row height; its failure inventory lists the new ways to fail.
- Docs: `workspace-ui` en and zh, Agent Note `implemented/feature/2026-10-24-phone-trajectory-cards.md`.

## Why

Joey asked for a large phone update: the ledger looked crowded. The 36 px toolbar buttons and their pill backgrounds come from the global `button` rule in `forms.css`, which the trajectory controls never escaped.

## Validation

- Before the change, `trajectory-phone` passed its existing checks; the screenshots showed the crowded rows, the 36 px buttons and overlapping inspector pills.
- After the change, `trajectory-phone` passes at en 390, en 360 and zh 390, including the new 44 px, 16 px and 56 px checks.
- `trajectory-tab`, `trajectory-inspector` and `trajectory-timeline` pass at desktop width, so desktop is unchanged.
- `pnpm --filter @trip/web typecheck`, `lint` (one existing warning in `PhoneTrajectory.tsx`, unchanged), `prettier --check`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `verify:docs`, `check-ui-copy` pass.

## Notes for the next person

- Playwright wants build 1194 and the sandbox has 1243; `PLAYWRIGHT_BROWSERS_PATH` pointed at a symlinked copy.
- Virtualization starts above 100 records; the E2E ledger has about 12, so the 56 px estimate is checked by row height, not by a long scroll.
