---
date: 2026-11-03
author: Claude Code
branch: fix/TP-352-ios-chat-redesign
pr: none
area: apps/web
contract-impact: none
---

# Phone chat: stacked examples, one chip row, one itinerary button

## What changed

- `apps/web/app/styles/phone/chat.css` (imported last by `phone/index.css`): stacked example list,
  one-row fact chips with an icon-only Preferences chip, full-width itinerary button, two-line title.
- `components/chat/ChatPanel.tsx`: phone examples render in the stream (three); no phone footer.
- `components/chat/MessageItem.tsx`: phone replies drop `PlanDays`; the button reads "Itinerary · N days".
- `components/account/SettingsDialog.tsx`: the estimates footer shows under each Settings section.
- E2E checks and failure modes in `phone-polish`; new note `2026-11-03-phone-chat-redesign.md`; docs.

## Why

Batch 2 of the redesign Joey approved on 2026-11-03.

## Validation

- `phone-polish.e2e.mjs`: 93/93 after; red/green recorded in the PR.
- `pnpm typecheck`: passes. A new copy key made it fail with TS2590 in `plan-revision.ts`, so the
  label reuses existing keys.

## Notes for the next person

TS2590 at `components/trip/plan-revision.ts:209` triggers when one more copy key is added; it needs a
narrower type there before the next new key.
