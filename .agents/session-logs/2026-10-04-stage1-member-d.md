---
date: 2026-10-04
author: GitHub Copilot
branch: docs/stage1-member-d-deliverables
pr: none
area: docs, submission/stage1
contract-impact: none
---

# Complete Stage 1 D individual deliverables

## What changed

- Added AH-D1 and R-D1–R-D5 in English and Chinese.
- Added UC-D1 and three full Mermaid behaviour models in both languages.
- Updated Stage 1 indexes, report source, individual-task table, slide 19, and D's speaking notes.
- Added rendered report and slide diagram assets plus a slide 19 preview.

## Why

The models distinguish weather forecasts from climate context, show deterministic checks around LLM output, and avoid unverified allergy-safety claims.

## Validation

- `npx --yes pnpm@9.15.0 verify:pairs` — passed; 21 pairs checked.
- `npx --yes pnpm@9.15.0 verify:protected` — passed.
- Prettier check and `git diff --check` — passed.
- Mermaid CLI rendered all report and slide diagrams; PowerPoint reopen confirmed slide title, three images and D speaker notes.
- `verify:docs` — failed on pre-existing archived-note path/link errors outside this change.
- `node submission/stage1/report-source/build.mjs` — blocked because `marked` is missing from the script's hard-coded external tools directory; the submitted PDF was not regenerated.

## Notes for the next person

Rebuild `ELEC5620_Stage1_Report.pdf` in the configured report-tool environment from `report-source/parts/`.