---
date: 2026-09-29
author: Codex
branch: main
pr: none
area: docs
contract-impact: none
---

# Document current architecture, agent collaboration, and LangChain usage

## What changed

- Added paired English and Chinese indexes with eight Archify architecture and workflow diagrams under `docs/architecture-diagrams/`.
- Linked the diagram index from both architecture pages and recorded pair reviews.
- Added Archify visual-check receipts, screenshots, contact sheets, and this session log.

## Why

The diagrams trace runtime boundaries from chat and LangGraph planning through agents, contracts, tools, storage, trip editing, and map rendering. The paired overview documents how `createAgent`, model routing, deterministic fallbacks, and ToolGateway fit into those flows.

## Validation

- Archify showcase validation and delivery: 8/8 diagrams, 9/9 checks each, 0 errors and warnings.
- Archify `visual-check`: 8/8 passed; inspected light/dark at 1440×900 and light at 2048×1320.
- `pnpm verify:docs`, `pnpm verify:protected`, and `git diff --check`: passed.
- Scoped Prettier check: passed after formatting JSON specifications.
- Translation pair check: the edited pairs were recorded; the overall check still reports the pre-existing untracked `docs/problem.md` has no Chinese pair.

## Notes for the next person

The untracked `docs/problem.md` was present before this task and remains untouched.
