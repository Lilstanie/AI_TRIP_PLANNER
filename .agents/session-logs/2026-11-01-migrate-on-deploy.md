---
date: 2026-11-01
author: Claude Code (for Joey)
branch: feature/TP-244-migrate-on-deploy
pr: none
area: apps/web, docs
contract-impact: none
---

# Vercel production builds apply pending migrations (TP-244)

## What changed

- `apps/web/package.json`: `vercel-build` runs `drizzle-kit migrate` before `next build` when
  `VERCEL_ENV=production` and `DATABASE_URL` is set.
- `docs/development.md` (+ zh): the step, its guards, and the missing-table symptom.

## Why

Settings showed "Could not load remembered preferences": the database never ran `0002_adorable_namor.sql`
(`account_memories`), because nothing runs migrations on deploy. Previews skip so an unmerged
migration never touches the production database.

## Validation

- Guard with `VERCEL_ENV=production` and an unreachable `DATABASE_URL`: `drizzle-kit migrate` failed,
  exit 1, `next build` did not run.
- Guard with `VERCEL_ENV=preview`: migration skipped, build step reached.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`.

## Notes for the next person

Not verified against the production database. If its tables were created without `drizzle-kit migrate`
(no `drizzle.__drizzle_migrations` rows), the first migrate re-runs `0000` and fails the deploy; the
owner should check that table before merging. Only applies if the Vercel Root Directory is `apps/web`.
