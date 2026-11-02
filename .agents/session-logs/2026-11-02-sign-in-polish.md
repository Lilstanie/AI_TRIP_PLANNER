---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-289-sign-in-polish
pr: none
area: apps/web
contract-impact: none
---

# Sign-in card names the app and the passcode block joins the card

## What changed

- `apps/web/app/layout.tsx`: `ClerkProvider` localization sets the sign-in title to "Sign in to
  AI Trip Planner"; Clerk's application name is lowercase "ai trip planner".
- `apps/web/app/styles/auth.css`: after the Clerk form, the admin passcode block uses the Clerk
  form's side inset, one top divider and a label styled like Clerk's field labels.

## Why

UI loop round 2 (2026-11-02): production sign-in showed the lowercase name, and the passcode block
was wider than the Clerk form with a grey meta-size label, so it looked bolted on.

## Validation

- Preview on production via injected CSS and title at 1440 px and 390 px.
- `tsc --noEmit` in apps/web: clean.
- No machine check: copy and spacing, not a bug class a lint or type can catch.

## Round 3: TP-290 placeholder chat titles in Chinese

- `apps/web/lib/workspace/catalog.ts`: `conversationTitle` translates the stored placeholder titles
  "New chat" and "New trip" unless the traveller renamed the chat. The top bar showed "New chat" in
  Chinese because only `ChatsPanel` translated them.
- Check: `tests/lib/workspace/catalog.test.ts` asserts the zh title; on the old code it fails with
  `expected 'New chat' to be '新聊天'`.
- Local dev at 1440 px and 390 px, zh: header reads 新聊天.

## Notes for the next person

- The sign-in page copy is English only; the workspace language setting does not reach it yet.
