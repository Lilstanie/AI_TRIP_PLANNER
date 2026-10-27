---
date: 2026-10-27
author: Claude Code
branch: feature/TP-114-glass-tokens
pr: none
area: apps/web, docs
contract-impact: none
---

# One liquid glass token set for every floating surface (#731, TP-114)

## What changed

- `tokens.css`: single `--glass-tint` (88%, light and dark) replaces `--glass-bg` and `--glass-bg-strong`; new `--glass-shadow-raised`.
- `glass.css`: floating surfaces (top bar, sidebar, team popover, sheets, phone tab bar and top bar) share one rule; new `glass-float` and `glass-float--raised` classes; chat empty card, map placeholder, trip-card caption and calendar grid are solid. Fallback lists updated.
- `phone-shell.css`, `phone-map.css`, `motion.css`: own glass declarations removed.
- E2E: `glass-calibration` and `liquid-glass` rewritten to the ticket (tokens, 4.5:1 contrast, reduced-transparency fallback, JSON plus screenshots); failures in `glass-tokens.failures.md`.
- Docs: `docs/design/ui-guidelines` (+ zh) glass section; `docs/e2e-known-failures` (+ zh).

## Why

The phone top bar carries the facts sheet as a fixed child, so it takes its material on a `::before`; `backdrop-filter` on the bar itself displaced the sheet.

## Validation

- `glass-calibration --prod`: ok, 3 consecutive runs.
- `liquid-glass --prod`: ok.

## Notes for the next person

The open-items popover should use `glass-float glass-float--raised`. Both scripts were already stale on main (language button, When chip).
