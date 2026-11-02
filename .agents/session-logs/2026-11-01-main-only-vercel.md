---
date: 2026-11-01
author: Claude Code for Joey
branch: chore/TP-255-main-only-vercel
pr: none
area: apps/web, docs
contract-impact: none
---

# Deploy only main on Vercel (TP-255)

## What changed

- `apps/web/vercel.json`: `git.deploymentEnabled` true for `main`, false for every other branch.
- `docs/development.md` (+ `.zh.md`): one paragraph on why PRs have no preview build.

## Why

Retro item F (2026-11-01 evening). 34 merges plus a preview on every PR push hit Vercel's deployment limit; the eight fixes merged before the Stage 2 deadline never went live. Previews were behind Vercel login and unused.

## Validation

See the PR Evidence section.

## Notes for the next person

Lilstanie owns the Vercel project; the file only takes effect because its Root Directory is `apps/web`. Check after merge that a docs-only PR shows no Vercel deployment and that main still deploys.
