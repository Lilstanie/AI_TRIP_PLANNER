---
name: end-to-end-feature-wiring
description: Trace a value across package, port, agent, persistence, streaming and UI boundaries until it reaches its intended consumer. Use when implementing a feature that crosses those boundaries, or when existing data or behavior is produced but does not reach its intended consumer.
---

# End-to-end feature wiring

Trace the behaviour from its source to the place that consumes it. A working adapter or calculation does not complete a feature if a wrapper, contract, exception path or UI drops its result.

1. State the expected behaviour in user-visible terms, then locate the producer and final consumer.
2. Trace the value across every boundary in between: provider adapter, typed port, decorators or wrappers, orchestrator, agent, shared contract, persistence or stream event, and UI as applicable. Search all implementations and call sites of changed port methods and fields.
3. Inspect every wrapper that reconstructs a typed object. Preserve the original interface and override only the behavior being decorated; prefer spreading the original object over maintaining a parallel method list. For complex user-facing behavior, prefer an E2E test as the sole behavioral check and save a repeatable artifact. If a wrapper must be checked in isolation, enumerate its failure modes before writing implementation code, then derive the focused check from that list.
4. Check that useful data is retained after validation or conflict checks and reaches the consumer. Cover exceptional and early-return paths too, especially when state is persisted only for one response type.
5. Test the boundary where the value could be lost, then verify the complete user-visible path when the change crosses into the app. For provider-specific constraints, follow [add-provider](../add-provider/SKILL.md); for visible UI changes, follow [ui-verification](../ui-verification/SKILL.md).
6. If the change affects a shared contract or records a lasting workflow decision, follow [agent-notes](../agent-notes/SKILL.md). Keep the relevant docs, skill and session log in step with the change.

## Queued work and user edits

Trace ownership as well as values whenever a request can outlive the plan that started it. Use the
existing [revision owner](../../../apps/web/components/trip/plan-revision.ts),
[auto-save caller](../../../apps/web/components/trip/useAutoSavePlaces.ts),
[leg-check caller](../../../apps/web/components/trip/useLegRoutes.ts) and
[tab guard](../../../apps/web/lib/trip/tab-revision.ts); do not add competing retry or ownership rules.

1. Identify the base plan, request context (currency/data mode), abort signal and final apply owner.
   At most one background job runs per trip. Chat turns, place searches and edits hold background
   work; starting an edit aborts its in-flight background request synchronously. Candidate swaps use
   the same edit owner as timeline changes.
2. Separate local discard from stale cross-tab ownership. A local abort or replaced plan yields
   `discarded`; callers release attempt bookkeeping so needed work can run for the current revision.
   A failed/refused job waits for its inputs to change. A cross-tab fingerprint mismatch yields a
   failed stale Notice and records the refused plan; offers for that plan stop until a fresh plan is
   loaded. Do not turn it into a discard/retry loop or silently adopt another tab's state.
3. Check both sides of the async boundary. A queued job checks ownership after acquiring the browser
   lock and before sending; a response checks local revision/abort and tab ownership before apply.
   Superseded edits stay silent; an edit answered after another plan replaces its base is stale and
   tells the traveller to try again. An accepted edit applies immediately; a refused edit retains the
   plan and shows blockers. Inspect Undo state and the session's timeline-change count separately:
   Undo may clear when the plan object changes, while a background apply must retain the count used
   for the chat-replacement notice. Two changes and one Undo must still leave one tracked change.
4. Describe the guarantee precisely. Web Locks serialize cooperating tabs when available;
   localStorage fingerprints detect stale browser plans. Without locks there is no serialized queue,
   and storage read/write failures weaken the guard. This is browser-local protection, not an atomic
   server revision check. Signed-in account sync is a separate owner
   (`apps/web/lib/account/catalog-sync.ts`): trips, conversations and settings carry a server-owned
   revision, an update must match it atomically, and a conflict stays local and pending
   ([decision](../../notes/implemented/bug-fix/2026-10-14-revision-based-account-sync.md)). Keep
   plan-edit ownership in the browser guard; do not treat a sync conflict as a stale plan or the
   reverse.

For behavior changes, write the failure inventory before implementation and exercise the public
journey with held responses: background save versus edit, verify versus edit, chat replacement,
trip switch, and a job queued behind another tab's edit. Confirm the late answer cannot apply;
locally discarded work resumes only when needed, while stale work sends no repeated requests and
shows its keyed Notice. Verify day routing waits for all places to be saved and records success only
after verification or an applied edit has routed it. Preserve commands, revision, fixture mode,
request counts, plan/notice assertions and screenshots; a final screenshot alone cannot prove absence
of a retry loop. Existing scenario owners are
[plan revision, including stale cross-tab work](../../../apps/web/tests/e2e/plan-revision.e2e.mjs),
[edit checks](../../../apps/web/tests/e2e/check-entry-point.e2e.mjs).

The [ownership decision](../../notes/implemented/feature/2026-10-09-plan-revision-owner.md) and
[PR #258](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/258) establish local interleaving;
[the accepted stale-work correction](../../notes/implemented/architecture/2026-10-10-map-fallback-review-fixes.md)
and [PR #278](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/278) make cross-tab stale work terminal.
Read their current consumers when changing wiring: a merged product fix still needs explicit skill
guidance. For money and error-subclass boundaries, use
[review-trip-planner](../review-trip-planner/SKILL.md).
