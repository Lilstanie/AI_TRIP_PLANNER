---
date: 2026-10-03
author: Claude Code
branch: docs/stage1-slides-polish
pr: none
area: submission
contract-impact: none
---

# Redesign the Stage 1 video slides and add their generator

## What changed

- `submission/stage1/ELEC5620_Stage1_Slides.pptx`: rebuilt, same 24 slides, order and speaker notes.
  Member colour tags and an A–E progress row, cards and icons instead of plain tables, numbered
  callouts on diagrams, dashed drop-zone templates for the A/B/D/E behaviour slides.
- `submission/stage1/slides-source/`: `build_deck.py` (python-pptx), diagrams re-rendered from the
  report's mermaid sources in the deck colours (`mmd-src/`, `cfg.json`), Lucide icons (ISC licence).
- Slide 7 title and `video-script.md` heading now say seven feature groups, matching the diagram.

## Why

Joey asked for a more polished deck; options agreed in the project thread: visual polish plus lighter
text, keep editable pptx, keep the report palette, no divider slides, Georgia/Arial for portability.
The class diagram images had clipped labels (fonts measured elsewhere); re-rendered with overflow visible.

## Validation

- `python3 build_deck.py` wrote 24 slides, every slide has notes.
- Rendered with LibreOffice to PDF and PNG and checked each slide for overflow and callout placement.

## Notes for the next person

- The report PDF still uses the old lavender mermaid figures; only the deck was restyled.
- Callout positions are image fractions in `build_deck.py`; re-check them if a diagram is re-rendered.
