# @trip/services

Server-side services shared by agents, tools and the web app: conversation and preference memory,
generated-plan storage, and the key-value store behind them. Owner: E (@WhW0591).

## Exports

| Export                         | Purpose                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `memory`                       | `MemoryStore`: short-term chat turns per trip and long-term preferences per user |
| `tripStore`                    | Stores and reads the latest generated `TripPlan` by trip ID                      |
| `jsonStore`, `createJsonStore` | Key-value JSON store with `get`, `set`, `increment` and `decrement`              |
| `durableStoreConfigured()`     | Whether the Redis REST store is configured                                       |
| `notify`, `auth`               | Stubs: notifications are not sent, and every request is the demo user            |

## Configuration

| Variable                                             | Effect                                     |
| ---------------------------------------------------- | ------------------------------------------ |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`               | Use an Upstash-compatible Redis REST store |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Accepted in place of the two above         |

Without them every value lives in process memory and is lost on restart or a serverless cold start.
Nothing reports that fallback at runtime. Rationale: [durable store note](../../.agents/notes/implemented/architecture/2026-09-21-redis-rest-durable-store.md).

## Contracts

- Agents receive `memory` as `ctx.mem` through `AgentContext`; they do not import it directly, so
  tests can pass a fake.
- The REST store is reached with `fetch` only; a plain Redis server cannot back it.
- Saved trips shown in the workspace come from browser storage, not from `tripStore`.

## Tests

`pnpm --filter @trip/services test` covers the store's local fallback and trip storage
(`tests/durable.test.ts`, `tests/trips.test.ts`).
