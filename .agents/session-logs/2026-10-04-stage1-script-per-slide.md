---
date: 2026-10-04
author: Claude Code (for Joey)
branch: claude/project-thread-sjvton
pr: none
area: submission/stage1
contract-impact: none
---

# Stage 1 video script is per slide, with no assigned speakers

## What changed

- `submission/stage1/slides-source/build_deck.py`: speaker notes no longer start with "Speaker X." and drop
  the "I'm <name>, member X" intros and the "Over to D" hand-off; member C's notes use third person.
- `submission/stage1/ELEC5620_Stage1_Slides.pptx`: regenerated from the script; only the notes changed.
- `submission/stage1/video-script.md`: regenerated from the deck notes, one block per slide with a time
  estimate and no member table; recording advice is voice-over with no camera.
- `submission/stage1/README.md`: row for the script updated.

## Why

The marking criteria and the Canvas video page set content and an 8-minute limit, but never require each
member to appear or speak, so Joey asked for a script written per slide rather than per member.

## Validation

- `python3 submission/stage1/slides-source/build_deck.py`: wrote the pptx.
- Grep for `Speaker`, `I'm` in the script and notes: none left.

## Notes for the next person

The slide chrome still shows each slide's owning member pill and badge row; that is ownership for
the contribution table, not who speaks. Change it in `chrome()` if the group wants it gone.
