# Agent Note: Server state lives in a Redis REST store with an in-process fallback

Status: implemented
Owner: E (@WhW0591)

## Problem

Chat turns, preferences, generated plans and the SerpApi usage counter and cache were kept in
process-local `Map`s. On Vercel every cold start lost them, so conversations forgot context and the
monthly SerpApi limit reset to zero, making the quota guard meaningless in production.

## Decision

`packages/services/src/durable/index.ts` provides one `JsonStore` (`get`, `set`, `increment`,
`decrement`) used by `memory`, `tripStore` and `packages/tools/src/serpapi.ts`. When
`KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the `UPSTASH_REDIS_REST_*` equivalents) are set, it
calls an Upstash-compatible Redis REST API over `fetch`; otherwise it keeps the same contract in
process memory. `MemoryStore` and the other service interfaces are unchanged, so agents and UI never
depend on the storage backend. Tests and offline runs need no store.

## Alternatives considered

**Keep process memory.** Rejected: state and quota do not survive serverless cold starts.

**A database or ORM behind `DATABASE_URL`.** Not adopted: a reserved `DATABASE_URL` sat unused, and
the data is small JSON documents and counters addressed by key, which a key-value store covers
without schema migrations.

**A Redis client over the wire protocol.** Not adopted: serverless functions open no long-lived
connections well, and the REST API needs only `fetch`. A consequence is that a plain `redis` Docker
image cannot back the store.

## Consequences

- Without the two variables a deployment silently runs in memory; `/api/data-mode` and the logs do
  not report it, so deployment checks must confirm the variables are set.
- Every read and write is an HTTP request; hot paths should stay coarse-grained.
- Chats and trips shown in the workspace still come from browser storage; see
  [workspace catalog trip storage](2026-09-24-workspace-catalog-trip-storage.md).

## Sources

Commit 1a1fcbb (`feat: persist planning state and provider quota`, PR #32) and the archived
[product closure TODO](../../../archive/todo-product-closure.md).
