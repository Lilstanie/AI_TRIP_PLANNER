---
date: 2026-10-23
author: Claude Code
branch: chore/ci-lsof-step-timeout
pr: none
area: .github
contract-impact: none
---

# CI lsof step can no longer hang a worker for an hour

## What changed

- `.github/workflows/ci.yml`, `cli-acceptance-workers`: the lsof install is a named step with an
  8-minute timeout. It skips the install when the runner already has lsof, and otherwise tries
  `apt-get update` and `install` up to three times, each call capped at 120 s. Joey approved the
  `.github` change on 2026-10-23 (retro item 1).

## Why

On 2026-10-22, PRs #594 and #598 each lost a worker to `sudo apt-get update` hanging until the
job's 60-minute timeout. Re-running only the failed job did not recover either: the aggregate job
could not find the plan artifact. Only a fresh run, started by merging `origin/main` into the
branch, did.

## Validation

- YAML parsed with Python `yaml.safe_load`.
- `pnpm verify:protected` and `pnpm verify:docs` pass.
- CI on this pull request runs the new step.
