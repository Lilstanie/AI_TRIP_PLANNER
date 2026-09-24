---
date: 2026-09-25
author: Codex
branch: main
pr: none
area: docs and agent skills
contract-impact: none
---

# Add an API discovery skill

## What changed

- Added `api-scout` to find relevant providers from the public-apis catalog and verify them against official documentation.
- Linked the skill from the provider plan and listed it in the repository workflow skills note.

## Why

The catalog is broad and changes over time; the project needs a repeatable way to shortlist APIs against real product gaps without treating directory metadata as provider guarantees.

## Validation

- `pnpm verify:docs` — passed.
- `pnpm verify:protected` — passed.
- `npx prettier --check` on the skill, provider plan, note and log — passed.
- `git diff --check` — passed.

## Notes for the next person

none
