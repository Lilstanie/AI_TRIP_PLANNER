---
date: 2026-10-13
author: Codex
branch: refactor/cli-collections-acceptance
pr: 320
area: testing, docs
contract-impact: none
---

# Integrate collections acceptance after CI policy changes

## What changed

- Integrated main containing sequentially merged PRs #318 (`0775728`) and #319 (`88d8ce3`).
- No content conflict; preserved both PR changes and translation review records.

## Validation

- Collections E2E on the integrated tree passed: two browser controls and seven fixture commands; evidence `output/e2e/cli-collections/run-Li9zqc/`.
- `pnpm verify:docs`, `pnpm verify:pairs` (26 pairs), `pnpm verify:protected`, changed-file formatting and scoped comment check passed.

## Notes for the next person

Fresh PR CI must pass on the integration head before merging #320. The earlier CI was bound to its previous SHA.
The original main worktree's unrelated changes remain untouched.
