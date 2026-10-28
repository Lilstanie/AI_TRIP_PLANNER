---
date: 2026-10-28
author: Claude
branch: feature/TP-134-quiet-rows
pr: none
area: apps/web, docs
contract-impact: none
---

# Quiet stop rows: no status tags, no fills, no drag sentence

## What changed

- `TimelineStop.tsx` drops the Place confirmed, Planned and Price needs checking tags; only Visited and Skipped still tag a row.
- `TripEditor.tsx` drops the drag helper sentence; `timeline.css` and `forms.css` drop its styles and the fills.
- Removed four catalog strings with their Chinese translations; updated five older E2E scripts that asserted them.
- Added `quiet-stop-rows` E2E with its failure inventory; documented the rows in `docs/workspace-ui.md` and `.zh.md`.

## Why

The grey time pill was the generic button rule outranking the time cell rule, so the time button is now excluded from it. Flight, stay and idea icons lost their fill and ring.

## Validation

- `quiet-stop-rows` E2E failed before the code (fills, tags, sentence) and passes after at 1440, 390 and Chinese.
- `stop-progress` and `open-in-maps` pass their edited steps and then fail on a later step exactly as before this change.

## Notes for the next person

Visited and Skipped tags stay because they are not the three tags in the ticket.
