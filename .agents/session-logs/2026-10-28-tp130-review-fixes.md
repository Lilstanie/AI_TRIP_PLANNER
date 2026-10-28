---
date: 2026-10-28
author: Claude
branch: feature/TP-130-review-fixes
pr: none
area: apps/web, packages/agents, docs
contract-impact: none
---

# Review fixes for the quiet itinerary panel (TP-130)

## What changed

- Destination guide: the entry and health tip keeps a short verify clause; one attraction is requested (schema, prompt, fallback) instead of five then sliced; the pace assumption that no longer applies is gone.
- `firstSentence` (web and agents, identical) no longer splits after dotted initials, "e.g.", "p.m.", month and title abbreviations or single letters; the panel skips a saved "Planning context for … only" scope sentence.
- Tablet navigation drawer: the Chats entry (which controlled a panel that is not rendered) is absent; the drawer lists its chats inline.
- Budget: transport with nothing priced already counts as one unpriced item; `one-line-budget` gains a `no-transport` scenario that pins it.
- E2E: `short-travel-tips`, `sidebar-no-chat-plus`, `one-line-budget` and their failure inventories.

## Validation

See the report for the commands run.
