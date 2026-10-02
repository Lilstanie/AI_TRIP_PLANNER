---
date: 2026-09-29
author: Codex
branch: docs/architecture-diagrams
pr: 97
area: docs
contract-impact: none
---

# Expand and organize architecture workflow diagrams

## What changed

- Added four diagrams for chat streaming, plan lifecycle, account sync, and agent trust boundaries.
- Grouped 12 diagram specs, rendered HTML viewers, and visual evidence under `docs/architecture-diagrams/`.
- Added paired indexes, LangChain usage notes, and links from both architecture guides.

## Why

The grouped index makes the project's agent collaboration and supporting runtime flows reviewable, while the LangChain notes distinguish agent/model responsibilities from LangGraph control flow.

## Validation

- Archify `deliver`: 12 diagrams passed 9/9 showcase checks each, with no errors or warnings.
- Archify `visual-check`: 12 diagrams passed at four viewports; visually reviewed new diagram screenshots.
- `pnpm verify:docs` — passed.
- `pnpm verify:protected` — passed.
- Scoped `npx prettier --check` and `git diff --check` — passed.
- Translation pair check reports only untracked `docs/problem.md` missing its Chinese pair; it remains untouched and excluded.

## Notes for the next person

PR #97 is open. No runtime code or shared contracts changed.
