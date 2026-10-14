---
date: 2026-10-15
author: Claude Code
branch: docs/refresh-readme-and-diagrams
pr: none
area: docs, README, apps/web
contract-impact: none
---

# Refresh READMEs, docs index and stale Archify diagrams

## What changed

- `README.md`/`.zh.md`, `apps/web/README.md`: Google-first map with OSM fallback, optional account
  sync, current layout, Local E2E CLI.
- `docs/README` index adds diagrams, Local E2E CLI, known E2E failures and agent setup;
  `architecture` entry points add accounts and sync.
- Regenerated `account-sync`, `trip-edit`, `map-exploration` and `tool-gateway` diagrams from code
  at `87e26199` (#334, #258, #278, #333), with source references and new visual-check evidence.
- Fixed misplaced or missing Chinese heading anchors in seven doc pairs.
- `.prettierignore`: Archify `rendered/` and `evidence/` output, whose receipts record hashes.

## Validation

- Archify `finalize` passed all four gates for each diagram; `visual-check` passed; light 1440x900
  captures were inspected.
- `pnpm verify:docs`, `verify:pairs` (9 pairs re-recorded), `verify:protected`,
  `format-check-changed origin/main` passed.

## Notes for the next person

none
