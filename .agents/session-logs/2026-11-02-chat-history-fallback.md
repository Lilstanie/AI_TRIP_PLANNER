---
date: 2026-11-02
author: Claude Code
branch: fix/TP-260-chat-history
pr: none
area: packages/shared, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# Chat requests carry the visible conversation as a memory fallback

## What changed

- `packages/shared/src/chat.ts`: `ChatHistoryTurn`, `MAX_CHAT_HISTORY_TURNS` and optional
  `ChatRequest.history`.
- `packages/orchestrator/src/chat/chat.ts`: seeds short-term memory from `history` when the store
  has no turns for the trip.
- `apps/web/components/workspace/useWorkspaceTransport.ts`: sends the last 20 visible messages with
  chat sends and ask-user answers.
- `docs/api.md`, `docs/api.zh.md`, Agent Note
  `.agents/notes/implemented/bug-fix/2026-11-02-follow-up-chat-confirm-and-grounding.md`.

## Why

Production (no KV) answered a follow-up with "this is the first message I have from you" when the
turn reached an instance with empty in-process memory.

## Validation

See the PR body for the commands run and their results.

## Notes for the next person

Configuring KV on Vercel would make server memory durable; the fallback stays harmless then.
