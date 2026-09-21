---
date: 2026-09-21
author: Claude Code (with A)
branch: feature/quick-prompts
pr: none
area: apps/web
contract-impact: none
---

# One-click example trips in the blank chat

## What changed

- `lib/planning/quick-prompts.ts` (new) — four complete example trips; dates are
  offsets from today, not literals.
- `components/chat/ChatPanel.tsx` — the blank-state buttons now send their own
  text instead of prefilling the composer, and show a short label with the full
  message as the tooltip.
- `useWorkspaceTransport.send()` takes an optional message to send.
- Exported `toIsoDate` from `lib/planning/date-range` rather than repeating its
  timezone-safe formatting.

## Why

The old suggestions stated no dates, travellers or budget, so clicking one led
to three follow-up questions before anything was planned. Completing them makes
one click produce a finished plan — the fastest way to exercise the planning
path by hand, and a better first impression than an interrogation.

Sending needs the explicit message: React state has not flushed when the click
handler runs, so `send()` reading `input` would send the previous (empty) value
and be swallowed by its own empty guard.

Two things the prompts had to be shaped around, both found by running them:
- The offline extractor keys destinations on "trip to <city>", so "trip from
  Melbourne to Sydney" lost the destination entirely whenever no model key was
  configured. `TripBrief` has no origin field either, so the origin was stating
  something the planner cannot use — every prompt names a destination only.
- "Tokyo" and "Sydney" are used in Workspace tests as markers that a fixture
  plan leaked into a blank chat. Those assertions are now scoped to the message
  log, since example buttons name cities on purpose.

## Validation

- `pnpm test` 471/471 (4 new); `pnpm typecheck`, `pnpm lint`, `pnpm build` clean
- One new test runs every prompt through the real `extractBriefPatchLocally`,
  asserting destination, dates and budget all survive with no model key
- In the browser, one click produced a full Sydney plan with no follow-up

## Notes for the next person

`extractBriefPatchLocally` not understanding "a trip from A to B" is a real gap
for anyone typing that phrasing without a model key configured. Worked around
here rather than fixed, to keep this change to the UI.
