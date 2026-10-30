---
date: 2026-10-30
author: Claude Code
branch: fix/TP-189-add-panel-selected
pr: none
area: apps/web, docs
contract-impact: none
---

# Add panel shows the selected tab and filter

## What changed

- `app/styles/timeline.css`: the selected Add panel tab and filter set `--button-bg: var(--accent-bg)`
  and `color: var(--accent)` instead of a border colour and weight.
- `tests/e2e/add-panel-selected.e2e.mjs`, `add-panel-selected.failures.md`, `docs/workspace-ui*.md`.

## Why

The generic button rule in `forms.css` (a long `:not()` chain, so very high specificity) set every
button's border to transparent and weight to 500, so the old selected rule never applied: Search,
Ideas, Saved and Custom, and the five filters, all looked the same. The generic rule reads
`--button-bg`, so setting that variable reaches through it.

## Validation

- `add-panel-selected.e2e.mjs` against dev (mock data) at 1440 px, dark mode and 390 px phone:
  before 28/39, after 39/39.
- Web `typecheck`, `lint`, `test`, `check-ui-copy`, `verify:docs`, translation pairs,
  `verify:e2e-selectors`, `verify:e2e-artifacts`, Prettier.

## Limitations

- Other selected-state rules that set only `border-color` or `font-weight` on plain buttons may be
  overridden the same way; this change covers the Add panel only.
