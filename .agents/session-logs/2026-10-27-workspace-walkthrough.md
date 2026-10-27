---
date: 2026-10-27
author: Claude Code
branch: feature/TP-113-walkthrough
pr: none
area: apps/web, docs
contract-impact: none
---

# Redesigned workspace walkthrough E2E (#739, TP-113)

## What changed

- `apps/web/tests/e2e/workspace-walkthrough.e2e.mjs` and `workspace-walkthrough.failures.md`: one fixture-mode journey at 1440x1000, 390x844 and 360x800, light and dark. It covers glass surfaces, empty map, Chat, Mine and Trajectory, sidebar entries, planning, the team capsule and panel, simple and full Trajectory, the open-items badge and popover, and the budget summary.
- Artifact: `output/playwright/workspace-walkthrough/<LABEL>/` holds numbered screenshots per size and theme plus `summary.json` with every check, the presses needed to reach the Agent Team and Trajectory, and the shot list.
- Bug found and fixed: `phone-shell.css` `.trajectory-empty` stretched the Plan in Chat button to the full sheet height on phones (344 px at 390x844); `align-content: start`.
- Docs: `docs/demo-runbook.md` and `.zh.md` gain the walkthrough steps.

## Why

The desktop top bar is transparent by design (its controls are glass), so the glass check targets the sidebar, composer, capsule and popovers on desktop, and the top bar's `::before` and tab bar on phones. The empty desktop map stays hidden at 1440 by the phone-map-empty-hint decision.

## Validation

- Before the CSS fix: 4 failures, all the stretched button. After: 286 checks, 0 failures, against a production build with mock tools.

## Notes for the next person

- A dark-appearance user's first paint is light until `applyAppearance` runs in an effect; the E2E waits for it.
- At 360 px the OpenStreetMap attribution on the empty phone map sits under the Locate me and layers buttons.
