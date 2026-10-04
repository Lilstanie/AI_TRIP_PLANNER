---
date: 2026-10-04
author: Claude Code (for Joey)
branch: docs/stage1-functions-slide
pr: 159
area: submission/stage1
contract-impact: none
---

# Stage 1 deck: add member A's functions slide; fix the summary overflow

## What changed

- `build_deck.py`: new slide 9 "Five specialists, five sections of one plan", ported from the deck member A
  edited by hand (`ELEC5620_Stage1_Slides_Solo.pptx`). Later slides move up by one; the deck has 25 slides.
- Summary slide: the last line shrinks to 42 pt in a wider box, so "control." no longer wraps onto the
  Stage 2 line.
- Notes for slides 9 and 24 shortened; `video-script.md` regenerated from the notes (about 7:55).

## Why

A's version replaced the B, D and E behaviour slides with functions, evidence and Agent Lab slides and
restored member labels. Joey chose to keep the current deck and add only the functions slide, since the
video brief names functions and the length must stay under eight minutes.

## Validation

- Deck rebuilt; slides 8–10 and 25 inspected as images. `pnpm verify:docs`, `verify:pairs`, `verify:protected`.
