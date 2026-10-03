---
date: 2026-10-03
author: Claude Code, for HeadmasterEggy (C)
branch: docs/stage1-submission
pr: none
area: submission
contract-impact: none
---

# Add the ELEC5620 Stage 1 submission files under submission/stage1/

## What changed

- `submission/stage1/ELEC5620_Stage1_Report.pdf`: the group report draft, built from `report-source/`.
- `submission/stage1/ELEC5620_Stage1_Slides.pptx`: the 24-slide PowerPoint used to record the video, with the script in the speaker notes. Generated from the online deck with python-pptx; text and tables stay editable.
- `submission/stage1/video-script.md`: per-slide script with each member's share of the 8 minutes.
- `submission/stage1/report-source/`: report chapters as Markdown, diagram sources and the build script.
- `submission/stage1/README.md`: what goes to which Canvas item and what is still missing.

## Why

Joey asked for everything to be submitted to live in the repository. The files sit outside `docs/`
because they are dated course deliverables, not documentation of the current system.

## Validation

`node scripts/verify-docs.mjs` and `node scripts/verify-protected-files.mjs` pass. The PDFs were
rendered with Chromium and checked page by page as contact sheets.

## Notes for the next person

The report's individual sections for A, B, D and E are placeholders until #136–#139 are done. Rebuild
the PDF from `report-source/` rather than editing it.
