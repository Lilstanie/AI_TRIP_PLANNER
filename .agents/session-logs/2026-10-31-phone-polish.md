---
date: 2026-10-31
author: Claude Code for Joey (HeadmasterEggy)
branch: feature/TP-193-phone-polish
pr: pending
area: apps/web, docs
contract-impact: none
---

# Phone UI refresh and the new-chat fact chip row (TP-193)

## What changed

- `apps/web/app/styles/phone-polish.css` (new, imported last by `phone.css`): floating capsule tab
  bar, card surfaces for budget, days, stops and tips, grouped lists in Mine and Trip home, Settings
  as a bottom sheet, larger titles. Scoped to `.workspace-app[data-phone]`.
- `ChatPanel` takes a `facts` node and renders it above the composer, outside the chat form;
  `WorkspaceView` passes its single `TripFactChips` there on a phone chat with no messages and no Plan.
- New `tests/e2e/phone-polish.e2e.mjs` with `phone-polish.failures.md`; `phone-empty-chat-hint` and
  `phone-shell` checks follow the new chip placement.
- Agent Note `implemented/feature/2026-10-30-phone-visual-refresh.md`; `docs/workspace-ui(.zh).md`.

## Why

Joey asked for a big phone visual refresh and chose the chip row above the composer. The chips first
rendered inside the chat form, so the editor's Save submitted the outer form and nothing was saved;
moving the row outside the form fixed it. A greeting heading was tried and dropped: the empty-screen
rule allows the "where to" question once, and the composer prompt already asks it.

## Validation

- `phone-polish.e2e.mjs` against `next dev` (mock data): 51/51.
- `phone-empty-chat-hint`: all pass; `phone-navigation`, `phone-mine`: exit 0 on rerun.
- `phone-shell`: the same 6 checks and `phone-state` companion fail on `main` with this diff stashed;
  one tablet check ("selecting a chat preserves the tablet Map view") failed once and passed on rerun.
- `tsc --noEmit`, `verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`,
  `check-file-length`, `check-ui-copy`: pass.

## Notes for the next person

- `phone-shell` title checks (44 px title button, Melbourne after replan) already fail on `main`.
- The coordinator avatar in the phone team capsule still overlaps its neighbours tightly.
