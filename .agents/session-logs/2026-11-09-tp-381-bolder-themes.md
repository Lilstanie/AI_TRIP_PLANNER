---
date: 2026-11-09
author: Claude (for Joey)
branch: feature/TP-381-bolder-themes
pr: pending
area: apps/web, docs
contract-impact: none
---

# TP-381 follow-up: themes carry their colour across the workspace

## What changed

- `apps/web/app/styles/themes.css`: Island, Sunset, Forest and City night now set a tinted page,
  surfaces, borders, glass tint and glass border, and an ambient wash about twice as strong.
- `docs/design/ui-guidelines(.zh).md`: Themes section says themes set their own glass tint.

## Why

Joey said the first version looked the same as the default: only the ambient wash changed, while the
white glass sidebar, composer and top bar covered most of the screen.

## Validation

- `themes` E2E 60/60 (AA contrast for every theme in both schemes) against `next dev`, `DATA_MODE=mock`.

## Notes for the next person

none
