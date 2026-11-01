---
date: 2026-11-01
author: Claude Code (for Joey)
branch: fix/TP-238-durable-chat-turns
pr: none
area: apps/web, packages/services, docs
contract-impact: api
---

# TP-238: an agent reply survives a page refresh

## What changed

- `apps/web/app/api/chat/route.ts` runs each turn under `after()`, independent of the connection,
  records frames via `apps/web/lib/chat/runs.ts`, and adds `GET /api/chat?run=<id>` to replay them.
- `apps/web/lib/workspace/pending-runs.ts` remembers the running turn per conversation;
  `useWorkspaceTransport` sends `x-chat-run` and resumes; `restoreWorkspace` reopens that chat.
- `packages/services/src/durable` gains `ttlSeconds` and keeps its local fallback on `globalThis`.
- Docs: `docs/api.md` + zh pair, Agent Note `bug-fix/2026-11-01-durable-chat-turns.md`.

## Why

Root cause: the turn lived only inside one POST stream with no record anywhere; on reload the client
had nothing to ask for and also opened a blank chat. Replay on the existing public route avoids a new
protected `verify-api-auth` entry.

## Validation

- `pnpm --filter @trip/web e2e chat-refresh-resume`: main 4/10 (reply lost), branch 10/10 in dev,
  10/10 with `--prod`, 10/10 with a temporary 6 s server delay (refresh mid-run).
- `pnpm --filter @trip/web test` (after mocking `after` in the persistence test), services test,
  web `tsc`, `pnpm --filter @trip/web lint`, `pnpm --filter @trip/web build`, file length check.

## Notes for the next person

Without KV on a multi-instance deployment a replay may miss the run and shows Retry. Stop still does
not cancel the server run.
