---
date: 2026-10-30
author: Codex
branch: feature/TP-155-trip-action-panels
pr: 782
area: docs
contract-impact: none
---

# Sync Trip home panel behavior into workspace UI docs

## What changed

- Updated `docs/workspace-ui.md` and `docs/workspace-ui.zh.md` for Expand/Collapse, in-panel tabs, scroll restore and stable map host.
- Listed `trip-home-action-panels` and `trip-home-send` with the existing Trip home E2E suites.

## Why

Standards review found the paired workspace UI pages still described the older drawer-only Trip home contract.

## Validation

- `pnpm verify:pairs`: Checked 34 documentation pairs against origin/main.
- `pnpm verify:docs`: Agent Notes, skills and Markdown links are valid.
- Exact-HEAD Spec/Standards/Ponytail and Maps-key E2E still pending after this commit.

## Notes for the next person

Calendar redesign remains `#796`. Preference overlay stays in HEAD.
