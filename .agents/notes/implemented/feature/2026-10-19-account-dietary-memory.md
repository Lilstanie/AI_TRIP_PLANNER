# Agent Note: Account dietary memory is server-owned

Status: implemented

## Problem

The planner needs to remember an explicit dietary preference across trips without treating trip details
as account facts, trusting an account id supplied by the browser, or changing Agent Lab's fixed inputs.

## Decision

- The web server recognizes the explicit spicy-food phrases in its deterministic allowlist and stores
  the normalized dietary value in the Postgres `account_memories` table. The generated schema and
  migration are `apps/web/lib/db/schema.ts` and `apps/web/drizzle/0002_adorable_namor.sql`.
- Chat and undo routes derive account identity from Clerk. Chat overwrites any `brief.userId` with the
  authenticated id; signed-out requests plan as anonymous and do not read or write account memory.
- `MemoryStore` receives long-term preferences from the account-scoped web adapter. Budget, area and
  other trip facts are not recognized or persisted. Agent Lab retains its own benchmark preferences.
- A chat response may carry one `memoryChange` token. The UI shows a localized notice and undo action;
  the token is scoped to the account and latest row version. Undo removes a first write or restores
  the prior value after replacement. Account export and deletion include these rows.
- The shared response field is additive. The shared contract change is recorded as `contract-impact:
packages/shared` in the session log.

## Alternatives considered

- **Keep long-term account preferences in Redis REST.** Rejected because this feature requires a
  relational account-owned record that participates in Postgres account export and deletion.
- **Let the browser own the account id or preference.** Rejected because client input cannot establish
  account identity and would allow cross-account reads or writes.
- **Use the existing Agent Lab preference fixture.** Rejected because benchmark inputs are fixed and
  read-only, not a user memory store.

## Consequences

- Only the explicit allowlisted dietary phrases are remembered; other needs require a future scoped
  recognition contract.
- The schema's composite account/key primary key stores one current dietary value per account, with
  one-step undo state. It does not provide an undo history or concurrent-edit history.
- `assistant.memory: false` suppresses writes while preserving normal signed-in planning.
- Settings lists and deletes the account's remembered categories through account-scoped routes; the
  category labels follow the selected interface language. The memory enable/disable switch remains
  outside this listing and deletion slice; see the [Settings decision](2026-09-27-mindtrip-settings.md).

## Sources

- GitHub issue #381 and the parent long-term memory specification.
- [Account routes](../../../../docs/api.md#account-routes) and
  [runtime boundaries](../../../../docs/architecture.md#contracts-and-dependency-injection).
