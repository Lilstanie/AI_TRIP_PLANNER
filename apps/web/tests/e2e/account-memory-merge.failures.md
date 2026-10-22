# Account-memory merge failure inventory

## Preference precedence

- A profile value in English is missed when extraction uses a brittle phrase or word-boundary rule; account memory then overrides the user's explicit profile.
- A Chinese travel-profile value (for example `不吃辣`) is missed by English-only extraction; conflicting dietary memory reaches dining.
- An interest keyword is matched inside an unrelated profile value (for example `art` inside `apartment`), suppressing account interests.
- A trip-specific brief value is replaced by either profile or account memory.
- An empty or unsupported profile value incorrectly suppresses a valid memory, or a supported value for an unrelated category suppresses it.
- Profile values are mutated while resolving precedence, changing saved profile or account memory.

## Memory lifecycle and account boundary

- A failed, cancelled, or incomplete plan writes memory or shows a successful remembered notice.
- A saved opt-out is bypassed by request data, a reader, or a writer; resuming reads stale/foreign account rows.
- One account can list, delete, undo, export, or consume another account's memory.
- A stale undo/delete race affects zero rows but is reported as successful, implying a change that did not occur.
- Undo selects a matching account/token row, then a concurrent replacement changes its token before the conditional restore/delete; if the write affects zero rows, the endpoint must return `undone: false` and leave the replacement intact for both restoration and first-write deletion.
  - Red before the fix: `pnpm --filter @trip/web e2e accommodation-memory` failed at the route assertion with actual `{ undone: true }`, expected `{ undone: false }` after the deterministic interleaving. Runner record: `output/e2e/runner/2026-10-21T00-48-02-646Z.json`.
- Concurrent writes to one account/key both read the same old row; the later upsert can erase an earlier accommodation patch and save a stale undo baseline.
  - Red before the fix: `pnpm --filter @trip/web e2e accommodation-memory` deterministically interleaved both writes and observed `{ stayType: "hotel", freeCancellation: true }` instead of preserving the concurrent `minRating: 8` patch. Runner record: `output/e2e/runner/2026-10-22T03-11-14-661Z.json`.
- Undo of a first write fails to remove it, or undo after replacement fails to restore the previous value.

## Persistence and integration

- Account deletion leaves memory rows behind or removes them after the account identity is already gone.
- Export omits memory or includes rows belonging to another account.
- The generated migration/schema metadata disagree with the table contract; review and local test use must not apply migration `0002` to an external database.
- Accommodation updates drop unrelated fields, or the stay type fails to reach provider search/cache behavior.
- A supported category is stored but no intended specialist consumes it, or category extraction stores unsupported/trip-only facts.

## E2E confidence

- Assertions observe helper output or fixtures rather than the production chat route, specialist boundary, Settings UI, or account routes.
- A test reports success without proving the resulting plan used the winning source, or skips a branch silently.
- Fixed-delay waits or environment-dependent provider/model behavior make the result flaky or non-repeatable.
