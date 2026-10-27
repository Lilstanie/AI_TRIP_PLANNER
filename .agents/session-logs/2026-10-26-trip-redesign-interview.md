---
date: 2026-10-26
author: Codex
branch: docs/trip-redesign-interview
pr: none
area: .agents/notes
contract-impact: none
---

# Define the Trip redesign through a documented design interview

## What changed

- Added the [proposed Trip redesign](../notes/proposed/feature/2026-10-26-trip-redesign.md).
- Recorded thirteen accepted choices covering all-device layout, editing, budget, AI and drafts.
- Defined four implementation tasks and a failure inventory for browser acceptance evidence.
- Identified proposed replacements for desktop drawer and desktop dismissal behaviour.

## Why

The requested UI and functional update needed explicit scope and replacement rules before coding.
Existing Stop/Idea vocabulary is sufficient; no glossary or separate ADR was needed.

## Validation

- `git fetch origin`: succeeded; local main and origin/main both at abc18859 when checked.
- `node scripts/verify-docs.mjs`: passed after the proposal updates.
- Read current Trip editing contracts and documented chat replacement behaviour.
- No application changes or browser tests were made for this proposal.

## Notes for the next person

- Complete proposal awaits final shared-understanding confirmation before tickets/implementation.
- User requires pre-push checks, /pr bodies, /retro after green CI, and explicit merge permission.
- The earlier local DeepSeek read-only task failed for missing credentials; it is not review evidence.
- Preserve the unrelated canonical checkout and its untracked .cursor directory.
