---
date: 2026-10-31
author: Claude Code
branch: feature/TP-192-chat-trip-title
pr: none
area: apps/web, docs, agent-notes
contract-impact: none
---

# A chat that opens a trip is named after the trip

## What changed

- `apps/web/lib/workspace/catalog.ts`: `conversationFrom` takes whether the chat opens its trip;
  `upsertCurrent` and `createCatalog` pass it, and such a chat is titled with `titleFor`.
  `conversationTitle` localizes that title instead of falling back to the first message.
- `tests/e2e/chat-trip-title.e2e.mjs` and `.failures.md`, `docs/workspace-ui*.md`, a new Agent Note.

## Why

Joey chose "Name after the trip" on 2026-10-30: the first-message title repeated the prompt and was
cut off in the header, the Chats list and Trip home.

## Validation

- `chat-trip-title.e2e.mjs` against dev (mock data) at 1440 px, English and Chinese: before 7/17,
  after 17/17.
- `chat-header` and `new-chat` E2E pass. `trip-home-send` passes except its console check, which
  fails only on dev-server HMR WebSocket messages from the script's own server.
- Web `typecheck`, `lint`, `test`, `check-ui-copy`, `verify:docs`, translation pairs,
  `verify:e2e-selectors`, `verify:e2e-artifacts`, Prettier.

## Limitations

- Existing auto-titled chats update on their next save, not on load.
