---
date: 2026-10-28
author: Claude Code
branch: feature/TP-129-itinerary-walkthrough
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Itinerary walkthrough E2E, superseding Agent Note and docs (#751)

## What changed

- `itinerary-walkthrough.e2e.mjs` and its failure inventory: one journey at desktop, phone (long-press drag) and Chinese covering drags, every menu, the Add to trip panel tabs, Undo, Legs, Directions and Show distances; screenshots and `result.json` under `output/playwright/itinerary-walkthrough/after/`.
- Agent Note `2026-10-27-itinerary-interaction.md` supersedes the confirm-before-save, draft protection, discard-confirm and sheet-editor parts of the 2026-10-26 redesign; the old note points to it.
- Glossary term Add to trip panel; stale sheet, full-page and Add place wording removed from `workspace-ui` and the mobile design page (en, zh).
- The Ideas helper line `timeline-ideas__hint`, its CSS, translation and allowlist entry are removed.
- Nine baseline-failing scripts listed in `e2e-known-failures` (en, zh).

## Why

The spec asks for one repeatable proof of the whole interaction and for the decision that reversed the redesign to be recorded. Edit title and Add note are not covered: set `WALKTHROUGH_DAY_TITLE_NOTE=1` once the Day menu has them.

## Validation

See the pull request evidence; commands run are listed in the final report of this session.

## Notes for the next person

The walkthrough waits for the saved plan to settle before each Undo snapshot: a snapshot taken right after a previous Undo was once seen holding the pre-Undo plan. The cause in the app is not investigated.
