---
date: 2026-09-25
author: Codex
branch: docs/project-orientation-map
pr: none
area: docs
contract-impact: none
---

# Added a project change-entry map

## What changed

- Added a task-oriented entry table to `docs/architecture.md`.
- Added [the project orientation map Agent Note](../notes/implemented/process/2026-09-25-project-orientation-map.md).

## Why

The X article recommended giving agents clear project entry points and routing detailed rules to
focused references. Existing project docs already cover business context, architecture, constraints
and verification; the gap was a quick path from a change area to its owning code and downstream
boundaries.

## Validation

- `pnpm verify:docs` — passed; Agent Notes, skills and Markdown links are valid.
- `pnpm verify:protected` — passed; protected-file rules hold relative to `origin/main`.
- `npx prettier --check docs/architecture.md .agents/notes/implemented/process/2026-09-25-project-orientation-map.md` — passed after formatting `docs/architecture.md`.
- `git diff --check` — passed.
- pnpm reported an existing warning that `pnpm.overrides` in `package.json` is ignored.

## Notes for the next person

The map should track entry-point ownership as the code moves. No runtime or UI behavior changed, so no
E2E artifact was needed.
