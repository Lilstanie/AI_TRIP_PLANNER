---
date: 2026-10-18
author: Codex
branch: fix/review-triage-oct17
pr: 438
area: apps/web
contract-impact: none
---

# Restore English example prompts and align date display checks

## What changed

- Keep example-trip requests in English while interface labels follow the selected locale.
- Update existing planning and workspace checks to interpolate prompt parameters and expect compact date ranges.

## Why

The CI failures exposed stale template/date assertions and a real regression where Chinese prompts were sent to the English-oriented trip parser.

## Validation

- Focused Vitest files for chat, trip facts, workspace, quick prompts and trip facts: 5 files, 93 tests passed.
- `NODE_OPTIONS=--no-experimental-webstorage pnpm test` — all packages passed; web 57 files/632 tests, orchestrator 23 files/275 tests.
- `pnpm --filter @trip/web e2e workspace-chinese` — passed, 27 checks at 1440px and 390px; artifact `output/e2e/runner/2026-10-17T15-06-55-327Z.json`.
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`, Prettier check and `git diff --check` — passed.

## Notes for the next person

- PR #438 remains open and draft pending current-head CI; do not merge without the owner's explicit instruction.
