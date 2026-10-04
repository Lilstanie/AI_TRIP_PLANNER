---
date: 2026-10-04
author: Claude Code (for Joey)
branch: claude/project-thread-sjvton
pr: 156
area: docs/design/stage1, submission/stage1
contract-impact: none
---

# Stage 1: all five members' individual items in one package; per-slide script; no member labels

## What changed

- Merged member D's branch (#142), A's `docs/stage1-member-a-behaviour` and B's `docs/member-b-uml-review`;
  added E's AH-E1, R-E1–R-E6, UC-E1 and diagram text from issue #139 (`04-member-e-behaviour.md` + zh);
  E's three diagrams cropped from a PDF Joey supplied into `docs/design/diagrams/member-e/`.
- `docs/design/stage1/`: §1.3 and §2.2 regrouped per member A–E; README lists each member's items.
- Report parts (02, 04, 08, 09, 00 §1.4) regenerated from the docs; §8 reordered A–E; PDF rebuilt (62 pp).
- Deck: `behaviour_slide()` builds slides 5 (A), 9 (B), 19 (D), 23 (E) from full diagrams in `mmd-src/`; member
  pills and the A–E speaker badges removed from slide headers; notes per slide with no speakers.
- `video-script.md` regenerated from the deck notes (about 7:52).

## Why

The course never asks members to appear or speak in the video (marking criteria, Canvas video page), so
Joey asked for a per-slide script and no member labels. A asked for core feature 2 to read "revision
routing and round control" instead of "conflict detection", which is C's.

## Validation

- `node submission/stage1/report-source/build.mjs`: 21 figures, 60 pages; pages 40-47 inspected.
- `python3 submission/stage1/slides-source/build_deck.py`; deck rendered via LibreOffice, slides 5, 6, 9,
  10, 19 inspected.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`: pass.

## Notes for the next person

E's diagrams are images with Chinese labels (no Mermaid source was supplied). They show the chat LLM
producing a structured suggestion that becomes an `EditRequest`, while E's own text and UC-E1 say the chat
LLM never creates one; E should reconcile the two before the interview.
