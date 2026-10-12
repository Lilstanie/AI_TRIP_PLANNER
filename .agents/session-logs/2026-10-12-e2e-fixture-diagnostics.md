---
date: 2026-10-12
author: Codex
branch: fix/e2e-fixture-diagnostics
pr: none
area: apps/web/tests
contract-impact: none
---

# Keep the CLI fixture failure diagnosable

## What changed

- `apps/web/tests/cli-e2e/local-cleanup.e2e.mjs`: the two fixture-setup assertions now report the
  child's exit status and stdout alongside stderr.

## Why

A CI run of the sequential CLI acceptance suite failed with `Fixture setup failed: ` and nothing
after the colon. The child had been killed before it wrote to stderr, so the message carried no
diagnostic and the failure could only be explained by re-running the journey locally.
`local-cli-collections.e2e.mjs` already includes stdout in its fixture messages; these two now match.

## Validation

- `npx prettier@3.4.2 --check apps/web/tests/cli-e2e/local-cleanup.e2e.mjs` - All matched files use
  Prettier code style.
- The journey itself needs `pnpm install`, a Next build and Playwright, so CI's `cli-acceptance` job
  is its first real execution.

## Notes for the next person

Only the failing path changes; a passing run is unaffected.
