---
date: 2026-10-29
author: Codex
branch: docs/TP-144-fixture-e2e-guidance
pr: none
area: docs, .agents/skills
contract-impact: none
---

# Prefer the existing isolated CLI for supported fixture journeys

## What changed

- Updated `ui-verification` and `pre-push-checks` to check journey support before choosing a runner.
- Documented raw-runner credential, dotenv, server-reuse and external-request setup in both
  `docs/local-test-cli.md` languages.
- Corrected the supported list and owning Agent Note to include `pending-ask-refresh`.

## Why

Trip home verification in PR #782 inherited an expired browser Maps key through the raw runner.
Mock data flags alone did not isolate the environment. The isolated CLI already provides the known
credential boundary for supported journeys; unsupported journeys still need explicit fixture setup.

## Validation

- `node apps/web/tests/e2e/run.mjs list --json` reported three supported journeys, including
  `pending-ask-refresh`; this is discovery evidence, not a browser run.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected` and changed-file formatting passed.
- The scoped skill drift check found no missing paths or broken commands in either changed skill.
- No executable, fixture or registry file differs from `origin/main`; browser reruns are not selected
  for this prose correction.

## Notes for the next person

This is a prose correction. The runner, fixture profile, supported registry and application code are
unchanged. The isolated CLI is not a network firewall. PR #782 remains separate and unmerged.
