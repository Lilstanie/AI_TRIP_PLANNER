---
date: 2026-10-31
author: Claude Code
branch: fix/TP-190-add-panel-fields
pr: none
area: apps/web, docs
contract-impact: none
---

# Add panel fields get the shared field style

## What changed

- `app/styles/timeline.css`: `.add-panel input:not([type="checkbox"])` joins the stop editor field
  rule (36 px, border, small radius, surface fill).
- `tests/e2e/add-panel-fields.e2e.mjs`, `add-panel-fields.failures.md`, `docs/workspace-ui*.md`.

## Why

The Add to trip panel sits outside `.stop-editor`, so its inputs had no field style at all: zero
border, no fill, 21 px tall. Name, Start time and Note on the Custom tab read as plain text, and the
search box was shorter than the Search button beside it.

## Validation

- `add-panel-fields.e2e.mjs` against dev (mock data) at 1440 px, dark mode and 390 px phone:
  before 16/30, after 30/30.
- Web `typecheck`, `lint`, `test`, `check-ui-copy`, `verify:docs`, translation pairs,
  `verify:e2e-selectors`, `verify:e2e-artifacts`, Prettier.

## Limitations

- None known.
