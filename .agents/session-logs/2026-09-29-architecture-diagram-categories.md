---
date: 2026-09-29
author: Codex
branch: docs/architecture-diagrams
pr: 97
area: docs
contract-impact: none
---

# Group architecture diagrams by project area

## What changed

- Moved all 12 diagram sources, HTML viewers, and browser evidence into four domain folders.
- Updated both indexes and visual-check receipt paths to match the new layout.

## Why

Grouping each diagram's source, viewer, and evidence under its project area makes related artifacts easier to find together.

## Validation

- Artifact path/hash and contact-sheet check — all 12 diagrams passed.
- `pnpm verify:docs` and `pnpm verify:protected` — passed.
- Scoped `npx prettier --check` and `git diff --check` — passed.
- Translation pair check reports only untracked `docs/problem.md` missing its Chinese pair; it remains excluded.

## Notes for the next person

The reorganized files are part of PR #97. No diagram content or runtime code changed.
