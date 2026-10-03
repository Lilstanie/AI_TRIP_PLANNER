---
date: 2026-10-03
author: Codex
branch: main
pr: none
area: packages/tools, docs
contract-impact: none
---

# Specify a deep provider-selection boundary behind ToolGateway

## What changed

- Added a proposed Agent Note for provider selection ownership and preserved behavior.
- Published GitHub issue #126 as the implementation specification and applied `ready-for-agent`.
- Defined the gateway-level provider matrix and existing Planning-loop E2E artifacts as the test seams.

## Why

The current gateway groups modules but leaves provider selection and fallback distributed across
maps, booking, and weather. The specification deepens that seam without changing shared contracts
or user-visible provider behavior.

## Validation

- `pnpm verify:docs` — passed.
- `pnpm verify:protected` — passed.
- `pnpm exec prettier --check .agents/notes/proposed/architecture/2026-10-03-deep-provider-selection.md .agents/session-logs/2026-10-03-provider-selection-spec.md` — passed.
- `git diff --check` — passed.
- Session-log length check — this log is below 60 lines; the repository still contains pre-existing
  over-limit logs from September.

## Notes for the next person

Start with the behavior-locking gateway matrix, then migrate maps, booking, and weather in order;
remove raw public adapter exports only after all production callers use the gateway.
