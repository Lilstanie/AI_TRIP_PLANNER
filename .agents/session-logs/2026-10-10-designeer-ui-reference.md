---
date: 2026-10-10
author: Codex
branch: main
pr: none
area: docs
contract-impact: none
---

# Add Designeer to UI reference resources

## What changed

- Added Designeer to `docs/design/ui-guidelines.md` and its Chinese counterpart.
- Described it as inspiration and kept the project's design contract authoritative.

## Why

The project already maintains a UI reference list for design resources.

## Validation

- `pnpm verify:docs` — Agent Notes, skills and Markdown links are valid.
- `git diff --check` — passed.

## Notes for the next person

The site content was not independently reviewed; this entry only records it as a reference.
