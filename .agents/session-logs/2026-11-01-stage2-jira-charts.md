---
date: 2026-11-01
author: Joey (HeadmasterEggy), assisted by Claude
branch: docs/stage2-jira-charts
pr: none
area: docs
contract-impact: none
---

# Jira burn-down and flow charts in the Stage 2 report, built from Jira data

## What changed

- README Stage 2 report (both languages): a Mermaid burn-down of TP Sprint 1 with a short reading.
- `docs/design/stage2/demo-evidence(.zh).md`: the burn-down, a scope change table, a created and
  resolved per day chart, status, type and assignee counts and lead times; replaces the "gap" note.

## Why

Joey asked for the burn-down and project overview figures, built from Jira rather than his
screenshots, so the charts are text in the repository and can be checked against Jira.

## Validation

- Data: JQL `project = TP` (240 issues, three pages) and the change history of all 19 TP Sprint 1
  issues (sprint added, story points, resolution). The rebuilt line matches Jira's sprint report:
  18 points at start, up on 21 and 29 October, zero on 1 November.
- Both charts rendered with Mermaid 11.4.0 in Chromium: no syntax errors.
- `pnpm verify:pairs`, `pnpm verify:docs`, `pnpm verify:protected`: pass.

## Notes for the next person

- Figures are a snapshot from 1 November 2026, 22:20 AEDT.
