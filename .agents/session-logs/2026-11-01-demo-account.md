---
date: 2026-11-01
author: Claude Code (for Joey)
branch: feature/TP-232-demo-account
pr: 881
area: docs
contract-impact: none
---

# Shared demo account for the Week 13 demo (TP-232)

## What changed

- `docs/demo-runbook.md` and `.zh.md`: new Demo account section naming the shared Clerk account
  (username `test`) and saying the password comes from Joey.

## Why

The demo needs a signed-in session for the model and live data; a shared account avoids a personal one.
Joey created the account in the Clerk dashboard of the development instance, so a provisioning script
written first in this PR was removed. The password stays out of the repository.

## Validation

- `pnpm verify:docs`, translation pair check, Prettier: see the PR body.

## Notes for the next person

The account exists only in Joey's Clerk development instance; a deployment with other Clerk keys
does not have it.
