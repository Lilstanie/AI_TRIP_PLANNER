---
date: 2026-10-03
author: Claude Code, for HeadmasterEggy (C)
branch: docs/stage1-report-models
pr: 134
area: docs
contract-impact: none
---

# Add Archify views of member C's Stage 1 behaviour diagrams

## What changed

- `docs/architecture-diagrams/stage1-member-c/specs/`: Archify sources for C's activity (`workflow`),
  sequence (`sequence`) and state machine (`lifecycle`) diagrams.
- `docs/architecture-diagrams/stage1-member-c/rendered/` and `evidence/`: delivered HTML viewers and
  their visual-check receipts, contact sheets and screenshots.
- `docs/design/stage1/04-member-c-behaviour.md` and `.zh.md`: one link per diagram to the viewer,
  source and evidence, right after each "Rendered:" line.

## Why

The Mermaid models in `04-member-c-behaviour.md` stay the full UML. The Archify views are simplified
so they fit one desktop screen. The activity view folds the booked-stay branch and the no-model path
into the deterministic pick. The sequence view drops the booking and LLM return messages. The state
view merges WaitingForTransport, Searching, Choosing and Priced into Waiting and Planning, and leaves
Kept out.

## Validation

- `archify validate --quality showcase`: all three pass 9 of 9 artifact checks with 0 composition
  errors and 0 warnings.
- `archify deliver`: all three exit 0.
- `archify visual-check`: all three pass at 1440×900, 1600×1000, 1920×1080 and 2048×1320.
- Perceptual review: the 1440×900 screenshots were inspected, light for activity and sequence and
  dark for the state machine. No clipped labels.
- `check-pairs.mjs --record docs/design/stage1/04-member-c-behaviour.md`, then `check-pairs.mjs`:
  20 pairs pass.
- `node scripts/verify-docs.mjs` and `node scripts/verify-protected-files.mjs`: pass.

## Notes for the next person

- In the sequence view, the first segment label ("Brief") sits under the first message label.
- The Archify viewer only fits the screen height when the viewBox width:height ratio is at least
  1.55, so keep that ratio when editing these specs.
- `docs/architecture-diagrams.md` does not list this folder yet.
