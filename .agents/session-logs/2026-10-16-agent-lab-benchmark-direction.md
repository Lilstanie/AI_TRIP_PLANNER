---
date: 2026-10-16
author: Claude Code (Opus 5.5)
branch: docs/agent-lab-benchmark
pr: none
area: docs, .agents
contract-impact: none
---

# Propose growing Agent Lab into a benchmark and add glossary terms

## What changed

- `.agents/notes/proposed/testing/2026-10-16-agent-lab-benchmark.md`: proposed note for a versioned
  Agent Lab benchmark (about 12 scenarios, fixture report first, capped live subset, metrics only).
- `GLOSSARY.md`: drops "single-user"; adds Account, Travel profile, Long-term memory, Rating and
  Benchmark.

## Why

Two grilling sessions settled the terms and the direction: long-term memory is specified in #380 but
paused at P2, and the next phase measures the planner instead of adding features. The benchmark
spec is #402; #401 hides the unbacked Long-term memory switch.

## Validation

- `pnpm verify:docs`: passed.
- `pnpm verify:protected`: passed.
- `prettier --check` on the three changed files: passed.

## Notes for the next person

- Adding scenarios extends the Agent Lab scenario id enum in `packages/shared`; that change needs
  `contract-impact: packages/shared` and an update to this note.
- The account sync "data not saved" report was set aside untriaged.
