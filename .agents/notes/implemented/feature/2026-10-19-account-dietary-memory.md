# Agent Note: Account preference memory is server-owned

Status: implemented

## Problem

The planner needs to remember explicit travel preferences across trips without treating trip details
as account facts, trusting an account id supplied by the browser, or changing Agent Lab's fixed inputs.

## Decision

- The web server recognizes explicit dietary, pace, interests, accessibility, accommodation and usual
  departure-city phrases in its deterministic allowlist and stores the normalized value in the Postgres
  `account_memories` table. The generated schema and
  migration are `apps/web/lib/db/schema.ts` and `apps/web/drizzle/0002_adorable_namor.sql`.
- Chat and undo routes derive account identity from Clerk. Chat overwrites any `brief.userId` with the
  authenticated id; signed-out requests plan as anonymous and do not read or write account memory.
- `MemoryStore` receives long-term preferences from the account-scoped web adapter. Budget, area and
  other trip facts are not recognized or persisted. This trip's brief takes precedence over the
  travel profile, which takes precedence over account memories. Account memories fill only categories
  left blank in both higher-priority sources. Agent Lab retains its own benchmark preferences.
- Recognized preferences are saved after successful planning, so incomplete, failed or cancelled turns
  do not silently save a preference without a notice.
- A chat response may carry one `memoryChange` token. The UI shows a localized notice and undo action;
  the token is scoped to the account and latest row version. Undo removes a first write or restores
  the prior value after replacement. Account export and deletion include these rows.
- Accommodation remains one category: its JSON string merges stay type, minimum rating and cancellation fields, preserving untouched fields and whole-value undo. Legacy scalar values remain readable. Optional `StayQuery.stayType` carries the preference through mock, SerpApi and Google Places searches; provider results do not independently verify property type. Cache keys include the type when present.
- The shared response field is additive. Its contract change was recorded as `contract-impact:
packages/shared` in the foundation session log.

## Alternatives considered

- **Keep long-term account preferences in Redis REST.** Rejected because this feature requires a
  relational account-owned record that participates in Postgres account export and deletion.
- **Let the browser own the account id or preference.** Rejected because client input cannot establish
  account identity and would allow cross-account reads or writes.
- **Use the existing Agent Lab preference fixture.** Rejected because benchmark inputs are fixed and
  read-only, not a user memory store.

## Consequences

- Only explicit allowlisted phrases for the six supported categories are remembered; other needs
  require a future scoped recognition contract.
- The schema's composite account/key primary key stores one current value per category per account, with
  one-step undo state. Writes for the same account/category are serialized so partial accommodation
  patches merge against the latest committed value and undo restores the immediately preceding write.
  It does not provide an undo history or concurrent-edit history.
  These writes use the dedicated interactive Neon session from the
  [memory transaction adapter decision](../bug-fix/2026-10-26-memory-neon-transaction.md); other
  account operations retain the HTTP adapter.
- A saved account opt-out or `assistant.memory: false` suppresses account-memory reads and writes. A request cannot override a saved opt-out; failed settings reads disable account memory while preserving normal
  planning. The signed-in Settings switch controls this preference; signed-out users see a sign-in
  hint and cannot change it. This supersedes the temporary hidden-control status in the
  [Mindtrip settings note](2026-09-27-mindtrip-settings.md#consequences).
- Settings lists and deletes the account's remembered categories through account-scoped routes; the
  category labels follow the selected interface language. Additional memory categories are tracked
  by the parent specification and its follow-up issues.

## Sources

- GitHub issue #381 and the parent long-term memory specification.
- [Account routes](../../../../docs/api.md#account-routes) and
  [runtime boundaries](../../../../docs/architecture.md#contracts-and-dependency-injection).
