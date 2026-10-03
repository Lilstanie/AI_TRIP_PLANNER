---
date: 2026-10-03
author: Claude Code, for HeadmasterEggy (C)
branch: docs/stage1-report-models
pr: 134
area: docs
contract-impact: none
---

# Make member C's Archify behaviour diagrams complete and remove the duplicate renders

## What changed

- `docs/architecture-diagrams/stage1-member-c/specs/`: the activity and sequence specs now carry every
  node, branch and message from the Mermaid sources. The state machine is now `c-state.workflow.json`
  and replaces `c-state.lifecycle.json`. The rendered HTML and evidence were regenerated.
- Removed `docs/design/diagrams/c-{activity,sequence,state}.{svg,png}`. In
  `docs/design/stage1/04-member-c-behaviour.md` and `.zh.md`, each "Rendered:" line now points only at
  the Archify view. The Mermaid blocks stay as the text source.
- `docs/architecture-diagrams.md` and `.zh.md`: new "ELEC5620 Stage 1: member C behaviour" group.
- `docs/design/stage1/README.md` and `.zh.md`: say where the SVG/PNG renders and the Archify views live.

## Why

The lifecycle renderer has fixed columns and shares one band between its middle lanes, so it cannot
place all 11 states without overlaps. The workflow renderer lays them out cleanly. Two notation limits
remain. The sequence renderer has no self-messages, so self steps are appended to the neighbouring
message label. The workflow renderer has no self-loops, so Choosing's `[invalid] / deterministic pick`
self-transition appears as that node's sublabel.

## Validation

- `archify validate --quality showcase`: all three pass 9 of 9 checks with 0 errors and 0 warnings.
- `archify deliver`: all three exit 0.
- `archify visual-check`: `c-state` passes. `c-activity` and `c-sequence` fail with only
  `viewer/viewport-overflow`, because they are intentionally taller than one screen; readability
  passes at every size.
- Screenshots of all three were inspected. The sequence's "Brief" segment label is no longer covered.
- `check-pairs.mjs --record` for the three changed pairs, then `check-pairs.mjs` (20 pairs),
  `verify-docs.mjs` and `verify-protected-files.mjs`: pass.

## Notes for the next person

Keep the Archify specs in step with the Mermaid blocks; the two describe the same models.
