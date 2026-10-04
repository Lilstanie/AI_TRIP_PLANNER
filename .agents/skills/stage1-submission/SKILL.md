---
name: stage1-submission
description: Change the ELEC5620 Stage 1 package in AI_TRIP_PLANNER (the design models under docs/design/stage1 and the report, slides and video script under submission/stage1) so every copy stays in step and the deck is regenerated, not hand-edited. Use when adding a member's deliverable or editing the report, slides, diagrams or speaker script.
---

# Change the Stage 1 package

One model lives in four places, and PRs #134, #140, #142 and #152 each had to bring them back in
step. Read [submission/stage1/README.md](../../../submission/stage1/README.md) for the build commands
and what is still missing; this skill says which copies a change touches.

## Where each piece is owned

| Piece                           | Owner (edit here first)                         | Copies that must follow                                                   |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| Requirements, use cases, models | `docs/design/stage1/*.md` and its `.zh.md` pair | `submission/stage1/report-source/parts/*.md` (a snapshot, not the master) |
| Report PDF                      | `report-source/parts/` + `build.mjs`            | `ELEC5620_Stage1_Report.pdf`, rebuilt, never edited                       |
| Slides                          | `slides-source/build_deck.py` + `mmd-src/*.mmd` | `ELEC5620_Stage1_Slides.pptx`, regenerated, never edited in PowerPoint    |
| Speaker script                  | `video-script.md`                               | The notes in `build_deck.py` for the same slide                           |

## Rules the history taught

- **Regenerate the deck.** Put a member's diagram source in `slides-source/mmd-src/`, render it into
  `slides-source/assets/diagrams/`, replace that member's `behaviour_template` call with `behaviour_slide` in `build_deck.py`,
  then run the script. A hand-edited `.pptx` is lost on the next run; #142 had to rebuild slide 19 from the generator.
- **One copy of each image.** Diagrams for the deck live only in `slides-source/assets/diagrams/`,
  with their source in `mmd-src/`. Do not add a parallel `diagrams` folder elsewhere under `submission/stage1/`, or
  commit preview screenshots; previews are evidence for the PR, not files.
- **Complete diagrams.** A diagram shows the whole model even when it no longer fits one screen or
  slide; split it into views rather than dropping elements. Do not keep two renderings of one diagram.
- **Both languages.** A change under `docs/design/stage1/` updates its `.zh.md` pair and records it with
  [translate-docs](../translate-docs/SKILL.md); CI fails an unrecorded pair. The report and slides are
  English only.
- **The slides stay a `.pptx`.** Do not convert them to PDF for submission; the report is the PDF.
- **One member per PR.** A member's deliverable PR touches their own `04-member-<x>-behaviour` page, their
  rows in `01-requirements` and `02-use-cases`, their report sections and their slides. Group items
  (contribution table, video link) go through the umbrella issue #135.
- **One session log per PR.** Write it once at the end; a second log for a merge or rename is noise.

## Checks

```bash
python3 submission/stage1/slides-source/build_deck.py   # needs python-pptx
node submission/stage1/report-source/build.mjs          # needs mermaid-cli, marked, puppeteer, Chromium
pnpm verify:pairs && pnpm verify:docs && pnpm verify:protected
```

Render the deck to images (LibreOffice to PDF, then PNG) and look at every slide you changed for
overflow and callout placement before saying it is done. Diagram callouts are image fractions in
`build_deck.py`, so re-check them whenever a diagram is re-rendered.
