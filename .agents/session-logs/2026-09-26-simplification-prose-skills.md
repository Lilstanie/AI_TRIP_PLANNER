---
date: 2026-09-26
author: Codex
branch: docs/simplification-prose-skills
pr: none
area: .agents/skills and docs
contract-impact: none
---

# Adapt two DSH workflows to AI Trip Planner

## What changed

- Added project-local `find-simplifications` and `prose-standard` with focused references.
- Replaced DSH-only paths, commands and documentation gates with existing project workflows.
- Added the implemented process note, development entry links and upstream MIT attribution.
- Read DSH's `agent-experience` for explanation; did not install it or change application code.

## Why

The user requested both skills adapted to this project. They complement feature delivery, review
and UI writing without importing DSH's architecture or authorizing unrelated cleanup.

## Validation

- `quick_validate.py` passed for both skills.
- `pnpm verify:docs` passed: notes, skills and Markdown links are valid.
- `pnpm verify:protected` passed against `origin/main`.
- `git diff --check` passed. No application E2E was needed for this instructions-only change.

## Notes for the next person

The earlier Libraries.dev audit log is preserved. No frozen history or protected root rule changed.
The new skills become available on the next turn. No push or pull request was requested.
