---
date: 2026-09-29
author: Codex
branch: docs/architecture-diagrams
pr: 97
area: docs
contract-impact: none
---

# Add a Chinese root README

## What changed

- Added a full Chinese counterpart at `README.zh.md` with translated project, setup, layout, documentation, scope and license sections.
- Made the root language switch reciprocal and linked Chinese readers to localized documentation pages.

## Why

The repository root now gives Chinese readers a matching overview and setup guide.

## Validation

- `pnpm verify:docs` — passed.
- `npx prettier --check README.md README.zh.md` — passed.
- Code fences match byte-for-byte and local README links resolve.
- `git diff --check` — passed.
- Pair checker reports only the pre-existing untracked `docs/problem.md`; root READMEs are outside its configured pairing scope.

## Notes for the next person

English and Chinese root README code examples and repository layout remain aligned.
