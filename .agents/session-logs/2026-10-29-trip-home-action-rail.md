---
date: 2026-10-29
author: Codex
branch: main
pr: none
area: docs
contract-impact: none
---

# Document the agreed Trip home action rail

## What changed

- Added paired English and Chinese design specifications in `docs/design/trip-home-actions.md` and
  `.zh.md`.
- Added a proposed Agent Note for the five in-place Trip home actions and their drawer behavior.
- Defined Trip, Chat, Trip home, Trip chat, Trip preferences and Booking in `GLOSSARY.md`.
- Linked the proposal from `docs/workspace-ui.md`, its Chinese pair and the documentation indexes.

## Why

The current Trip home already supports several Chats, but three action cards leave the page and
break context. The agreed design keeps the Trip, Chats and map together while actions open in a
right-side drawer. The workspace UI pages continue to describe current behavior and mark the new
interaction as not yet implemented.

## Validation

- `pnpm verify:docs` passed after correcting one Agent Note link.
- `pnpm verify:protected` passed against `origin/main`.
- `git diff --check` passed.
- `git fetch origin --prune` updated the remote refs; `git pull --ff-only origin main`
  fast-forwarded local `main` by 8 commits before editing.

## Notes for the next person

The implementation has not started. The unrelated untracked `.cursor/` content was preserved.
