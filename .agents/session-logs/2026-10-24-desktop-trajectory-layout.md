---
date: 2026-10-24
author: Claude Code
branch: feature/TP-82-desktop-trajectory-layout
pr: pending
area: apps/web, docs
contract-impact: none
---

# Desktop trajectory layout (TP-82)

## What changed

- `components/trajectory/views.module.css`: the trajectory root is the inline-size container.
- `components/trajectory/TrajectoryTable.module.css`: under 820 px the inspector stacks under the ledger and its body scrolls; inspector tabs, close button, overview headings and step markers drop the global pill style.
- `components/trajectory/TrajectoryToolbar.module.css`: 26 px toolbar buttons, 22 px hit steps.
- `components/trajectory/TrajectoryTimeline.module.css`: 64 px one-line lane labels.
- E2E: `trajectory-tab` checks the stacked inspector, compact toolbar buttons and plain inspector tabs; failure inventory updated.
- Docs: `workspace-ui` en and zh, Agent Note `implemented/feature/2026-10-24-desktop-trajectory-layout.md`.

## Why

Joey said the web trajectory was crowded too. At 1440 px the inspector halved a 630 px ledger and the controls kept the 36 px global pill style.

## Validation

- `DATA_MODE=mock node scripts/redgreen.mjs trajectory-tab -- <changed css>`: before (origin/main) exit 1, 96/102 ok; after exit 0, 102/102 ok.
- `trajectory-phone`, `trajectory-inspector`, `trajectory-timeline` pass.

## Notes for the next person

- A container query cannot style its own container, so the container moved from `.split` to the view root.
