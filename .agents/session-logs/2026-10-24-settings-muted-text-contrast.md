---
date: 2026-10-24
author: Claude (project thread for Joey)
branch: fix/settings-muted-text-contrast
pr: none
area: apps/web
contract-impact: none
---

# Settings supporting text meets 4.5:1

## What changed

- `apps/web/app/styles/settings.css`: `.settings-lead`, `.settings-hint`, `.settings-sync` and
  `.settings-danger p` use `var(--text-dim)` instead of the text colour at 50% alpha.
- New E2E `settings-muted-text-contrast` and its failure inventory; `docs/workspace-ui` (en and zh).

## Why

#642: the supporting text was about 3.3:1 on the light dialog glass, below WCAG AA.

## Validation

- `node scripts/redgreen.mjs settings-muted-text-contrast -- apps/web/app/styles/settings.css`:
  before 19/24 ok (all five light sections at 3.26:1), after 24/24 ok (light 5.02:1, dark 6.49:1).
- `pnpm --filter @trip/web lint`, `test`: pass.
