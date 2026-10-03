---
date: 2026-10-04
author: Claude Code
branch: docs/stage1-member-d-deliverables
pr: 142
area: submission/stage1
contract-impact: none
---

# Move member D's slide into the deck generator

## What changed

- Merged `main` (which now builds the deck from `slides-source/build_deck.py`, #152) into this branch.
- Resolved the binary conflict in `ELEC5620_Stage1_Slides.pptx` by regenerating it rather than keeping either hand-edited copy.
- Replaced slide 19's placeholder template in `build_deck.py` with D's ad hoc requirement, UC-D1 and the three behaviour diagrams, and kept D's speaker notes.
- Copied D's slide Mermaid sources into `slides-source/mmd-src/` and re-rendered them with the deck theme into `slides-source/assets/diagrams/`.

## Why

The deck is now generated. A hand edit to the `.pptx` cannot be merged and would be overwritten on the next build.

## Validation

- `python3 build_deck.py` — wrote 24 slides; slide 19 has three pictures and D's notes.
- Laid out a preview of slide 19 from the shape positions and checked that the diagrams fit their panels.
- `verify:pairs` and `verify:protected` — see the pull request checks.

## Notes for the next person

Change slides in `build_deck.py` and re-run it; do not edit the `.pptx` by hand.
