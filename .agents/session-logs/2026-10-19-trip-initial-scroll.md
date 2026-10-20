---
date: 2026-10-19
author: Codex
branch: fix/trip-initial-scroll
pr: none
area: apps/web, docs
contract-impact: none
---

# Keep the Trip budget visible on initial open

## What changed

- DayStrip.tsx reveals the selected day by changing only the strip scrollLeft.
- trip-initial-scroll.e2e.mjs covers initial open, reopen and saved-chat reload at three widths, deliberate scroll restoration and keyboard navigation.
- Updated workspace-ui and e2e-known-failures in both languages.

## Why

scrollIntoView moved vertical ancestors on desktop. Resetting on every open would violate the existing deliberate-scroll preservation contract.

## Validation

- Tested source/test tree: 12f8a2249cf70742322f8a5a02a4246da75e5edc, tree e98adb6911ab572be660f460be58467c91ccc5ee; subsequent change adds only this log.
- Node 26.8.1, pnpm 9.15.0, Chrome 155.0.8059.82; anonymous mock mode, model/Maps/Clerk keys blank, reduced motion; English, no live services asserted.
- pnpm --filter @trip/web e2e trip-initial-scroll: baseline 2e0f506 fails (exit 1), offsets [163,163,163,0,0,0]; runner 2026-10-19T12-47-26-049Z.json.
- Final same command: exit 0, nine offsets 0 at 1280×800, 1440×1000 and 390×844; budget fully inside each panel, deliberate scroll 140 retained, End/Home/arrows work, no page overflow or page/console errors.
- Final runner 2026-10-19T12-54-47-118Z.json; screenshots and geometry in output/playwright/trip-initial-scroll/final/.
- Intermediate console-check failure is retained in reviewed/ and console-diagnostic/: existing /favicon.ico 404. Final test explicitly fixtures that exact request with 204; it does not verify favicon delivery.
- pnpm --filter @trip/web test: exit 0, 57 files / 632 tests; lint and typecheck: exit 0.
- pnpm verify:docs, verify:pairs, verify:protected, verify:e2e-artifacts, verify:e2e-selectors: exit 0.
- pnpm format:check-changed origin/main and git diff --check: exit 0; scoped check-added-comments.mjs: no violations.

## Notes for the next person

The original reporter wording cannot generate a plan offline; the repeatable fixture uses explicit dates and party size. Phone baseline was already 0. Physical devices, live authentication/providers and Chinese UI were not verified in this focused scroll test. No shared contract or Agent Note changes. Quote evidence in the PR before clean:output removes local artifacts.
