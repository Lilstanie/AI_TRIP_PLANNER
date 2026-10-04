---
date: 2026-10-04
author: Claude Code (for Joey, member C)
branch: docs/stage1-contributions
pr: none
area: submission/stage1, docs/design/stage1
contract-impact: none
---

# Stage 1 report: contribution table and video link filled in

## What changed

- `submission/stage1/report-source/parts/09-closing.md`: §13.1 contribution percentages.
- `submission/stage1/report-source/parts/00-front.md`: cover video link https://youtu.be/x9cKzPXNB1U.
- Rebuilt `submission/stage1/ELEC5620_Stage1_Report.pdf` (still 64 pages).
- `docs/design/stage1/README.md` and `.zh.md`: the same percentages for the four group diagrams.
- `submission/stage1/README.md`: what is still missing.

## Why

Joey gave the link and asked for a near-even split: C most, A (repository owner) second, the rest
equal. Every row is A 21%, B 17%, C 28%, D 17%, E 17%. Closes the remaining items of #135
apart from the Canvas submission.

## Validation

- `node submission/stage1/report-source/build.mjs`: wrote the PDF, 24 figures from the cache.
- `pdftotext` diff against the previous PDF: only the cover link and §13.1 changed.
- `pnpm verify:pairs`, `verify:docs`, `verify:protected`: all pass.

## Notes for the next person

The figure cache (`img/gen/*.mmd.done`) is Git-ignored; copy it from the shared folder or install
mermaid-cli before rebuilding.
