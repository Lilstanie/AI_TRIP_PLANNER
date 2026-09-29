---
date: 2026-09-29
author: Codex
branch: docs/architecture-diagrams
pr: 97
area: docs
contract-impact: none
---

# Move the root README language switch to the top

## What changed

- Added the English/Chinese navigation link before the root README title.
- Kept the documentation section focused on the English index link.

## Why

Readers can choose the Chinese documentation as soon as they open the repository README.

## Validation

- `pnpm verify:docs` — passed.
- `npx prettier --check README.md` — passed.
- `git diff --check` — passed.

## Notes for the next person

The repository has no root `README.zh.md`; the Chinese entrypoint is `docs/README.zh.md`.
