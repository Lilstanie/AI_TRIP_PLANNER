---
date: 2026-10-04
author: Claude Code (for Joey)
branch: docs/stage1-member-e-diagrams
pr: 158
area: docs/design/stage1, submission/stage1
contract-impact: none
---

# Stage 1: member E's behaviour diagrams redrawn to match the code and E's text

## What changed

- E's three diagrams (activity, sequence, state for UC-E1) are now Mermaid: `slides-source/mmd-src/e-*.mmd`
  for slide 23, inline in `04-member-e-behaviour(.zh).md` and report §8.5. The cropped PNGs in
  `docs/design/diagrams/member-e/` and `report-source/img/` are removed.
- The state machine paragraph names the new end states (Rejected, Stale) in en, zh and the report.
- Report PDF (64 pp) and deck rebuilt.

## Why

E's original images showed the chat LLM interpreting a request and producing the `EditRequest`, while E's
text, UC-E1 and the code say the chat coordinator has no edit tool. The code decides it:
`apps/web/lib/trip/trip-edit.ts` (`previewEdit`) is called only from `/api/trip/preview-edit`, which only
`useTimelineEdits.ts` calls; `apply()` there checks `preview.baseVersion` against the current
`editVersion`, and `EditPreviewPanel` disables Apply while blockers exist. Joey asked to decide for E.

## Validation

- `pnpm verify:docs`, `verify:pairs`, `verify:protected` pass.
- Report pages 56–58 and slide 23 inspected as images.

## Known limitations

- §13.1 contribution table and the video link are still open (#135).
