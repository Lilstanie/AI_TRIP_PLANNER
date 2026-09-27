---
date: 2026-09-27
author: Claude Code
branch: feature/settings-mindtrip
pr: none
area: apps/web, packages/shared, packages/orchestrator, docs
contract-impact: packages/shared
---

# Settings redesigned after Mindtrip's, with communication style and a memory switch

## What changed

- `apps/web/components/account/SettingsDialog.tsx` and `settings.css`: a section list on the left,
  labelled rows with Change, and Mindtrip-style memory rows. The sections are Edit profile, Your
  account, Personalization, Language & region and Connected accounts.
- `AccountProvider`: first and last name, email-verified state, connected sign-ins and `rename`.
- `packages/shared/src/chat.ts`: `AssistantSettings`, sent as `ChatRequest.assistant`.
  `packages/orchestrator/src/chat.ts` applies the style rule and memory off.
- `lib/account/settings.ts`: `assistant`, with a default. The workspace sends it with each chat
  request.
- Docs: workspace-ui and api (EN and ZH) and the
  [Mindtrip settings note](../notes/implemented/feature/2026-09-27-mindtrip-settings.md).

## Why

The owner asked for Mindtrip's settings, with what the planner can support added.

## Validation

- `pnpm typecheck` and `pnpm lint`: pass.
- `apps/web/tests/e2e/settings.e2e.mjs` (rewritten for the new sections): 36/36 at desktop and phone
  widths. Screenshots are in `output/playwright/settings/`.

## Notes for the next person

- The signed-in rows (name, connected accounts, delete) were not exercised; the E2E runs signed out.
