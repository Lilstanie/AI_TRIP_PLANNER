---
date: 2026-09-24
author: Claude Code (Opus 5.5, subagent)
branch: feature/mindtrip-trip-editors
pr: none
area: apps/web, packages/shared, packages/orchestrator, packages/agents, docs
contract-impact: packages/shared
---

# Mindtrip-style Where and Trip preferences editors, with preferences that reach the planner

## What changed

- `packages/shared`: optional `TripBrief.preferences` / `PartialTripBrief.preferences`
  (`TripPreferences`, 12 × 200 chars). `BriefPatchSchema` carries it from `known`; the supervisor
  and all five specialists get it with `TRAVELLER_PREFERENCES_RULE`.
- `WhereFields.tsx`, `PlaceInput.tsx`: destination cards, an Add destination pill that becomes a
  pill search field with Clear, live-mode-only suggestions (3 chars, 350 ms, bold match); Departing
  from as a quieter section below.
- `PreferenceList.tsx`: filled input on top, filled rows, click the text to edit, remove, duplicate
  refusal, 12-item cap. Nationality, room allocation, rating and free cancellation are retired
  (`RETIRED_FIELDS`), passed through.
- `FactPopover` `modal` variant sized to the parent's Mindtrip measurements (512 px, leading
  close, 20 px title, ink pill Save/Done).
- Docs: workspace-ui, api, architecture, ui-guidelines, class-diagram source; new
  [trip preference list note](../notes/implemented/feature/2026-09-24-trip-preference-list.md),
  facts corrected in the preference chips note.

## Why

The owner asked for Mindtrip's Where and Preferences dialogs and for traveller-written preferences
in place of passport and accommodation. This agent's Mindtrip visit hit a Cloudflare human check
(not completed); the parent session supplied measurements instead.

## Validation

- `pnpm test`: 6/6 tasks (shared 47, agents 117, orchestrator 115, tools 113, services 4, web
  333). `pnpm typecheck`: 6/6. `npx tsc --noEmit` (apps/web), `pnpm --filter @trip/web lint`,
  `pnpm verify:docs`, `pnpm verify:protected`: clean.
- `npx prettier --check` on changed files: clean except five agent `index.ts` files and
  `supervisor.ts`, which were already unformatted on main and were not reformatted here.
- Browser (port 3001, mock mode; one live suggestion test in the first pass): pane size (1271 px)
  light and dark, 390×844 light and dark; add, click-to-edit and remove preferences, Clear, Escape
  layering, focus return, no horizontal scroll.

- Parent session: after the owner cleared Mindtrip's check, measured its Where and Trip preferences
  dialogs (read only) and had the editors matched to them; checked both in the browser, and split
  the change into shared contract, planner, web and docs commits.

## Notes for the next person

- `docs/design/diagrams/class-2-domain.svg` was re-rendered by the parent session (Mermaid 11) for
  `+preferences`.
- Preferences are weighed by models only; deterministic fallbacks ignore them.
