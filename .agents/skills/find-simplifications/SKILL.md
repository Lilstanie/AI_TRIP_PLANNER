---
name: find-simplifications
description: Find evidence-backed simplifications in AI_TRIP_PLANNER code, APIs, configuration, tests and documentation. Use when asked to identify or implement removal of dead, duplicated, speculative or unnecessarily maintained behavior, while preserving travel data truthfulness and complete user flows.
---

# Find simplifications

Find changes that remove maintained obligations: representations, state, configuration, APIs,
dependencies or duplicate explanations. Prefer a few supported candidates over a deletion count.
This is guidance, not a complete checklist. A survey reports proposals; it does not authorize their
implementation or a repository-wide cleanup.

## Establish the scope

Use the user's requested area. For a broad survey, cover distinct runtime domains sequentially;
delegate only when the user or applicable instructions authorize it. Read the relevant
[architecture](../../../docs/architecture.md), [development rules](../../../docs/development.md),
[roadmap](../../../docs/roadmap.md), implementation, existing tests and active Agent Notes.

Keep package boundaries and protected-file rules in [AGENTS.md](../../../AGENTS.md). Shared-contract
changes need an Agent Note; protected root configuration needs the user's explicit authorization.
Frozen archives and dated logs are evidence, never cleanup candidates.

## Search for removable obligations

- **Trace both ends.** A declaration, forwarding field or test does not prove a working feature.
  Follow producers, port wrappers, orchestrator, stream or store, and the final UI consumer. Search
  reads, writes, emitters, API paths, serialized keys and package exports with `rg`, then read matches.
  Use [end-to-end-feature-wiring](../end-to-end-feature-wiring/SKILL.md) for the complete path.
- **Ask which distinctions change an action.** Remove duplicated state only when consumers need the
  same outcome. Preserve source kinds, unknown versus zero prices, cancellation, request ownership
  and persisted versions when they carry different promises.
- **Read the authoritative value when needed.** A derived count or projection may remove another
  cache, subscription and recovery path. Establish when the consumer needs the value and whether
  the owner is available then; moving the same synchronization elsewhere is not simplification.
- **Offer a smaller explicit capability.** A used subsystem can still be expensive. State the
  behavior given up and all machinery removed, including residual glue. Product trade-offs remain
  proposals until implementation is authorized.
- **Count the complete cost.** Include manifests, exports, fixtures, adapters, migration paths,
  documentation and dependencies. Fewer files or lines do not establish a net reduction.

For calibration, read [project patterns](references/project-patterns.md). Historical removals are
examples, not a current deletion inventory. Zero repository callers is not proof that a public API,
stored field, dynamic model tool or deployed endpoint has no consumer.

## Preserve behavior and failure semantics

Providers remain behind shared ports and the tools gateway. Keep mock/live isolation, quota and cache
limits, AUD whole-party conversions and truthful live/estimated/mock/fallback/unavailable provenance.
Follow [add-provider](../add-provider/SKILL.md) when the candidate touches provider behavior.

Name each asynchronous operation's owner, cancellation path and completion condition. Do not collapse
states merely because the happy path looks alike. Preserve late-response protection, browser snapshot
validation and the stated handling of old data. Parsing at an external or persisted-data boundary is
different from repeatedly validating an already-owned internal value.

For a dependency replacement, inspect installed dependencies and platform builtins first. Compare
the removed implementation and dedicated checks with the replacement's dependencies and glue. Verify
cancellation, truncation, bounds and source/build behavior where relevant; do not rebuild the same
subsystem around a library and call it smaller.

## Report and implement within authorization

For each supported candidate, state:

| Location | Producer and consumers | What disappears | What remains or is lost | Strongest reason to keep it | Evidence and verification |
| -------- | ---------------------- | --------------- | ----------------------- | --------------------------- | ------------------------- |

Separate unreachable behavior, an explicit product trade-off, and insufficient evidence. Reject
candidates that break a retained promise or merely relocate complexity. Report the actual coverage
and meaningful deferrals; do not describe an unverified search as exhaustive.

Use [agent-notes](../agent-notes/SKILL.md) to consolidate or propose lasting decisions. Refresh current
evidence before revisiting a rejected alternative, and leave frozen records unchanged. Use
[prose-standard](../prose-standard/SKILL.md) when explanations also need consolidation.

For authorized implementation, enumerate failure modes before any necessary isolated implementation
and tests; never write unit tests after code. Prefer a user-path E2E with a repeatable artifact.
Select checks through [pre-push-checks](../pre-push-checks/SKILL.md), verify visible changes through
[ui-verification](../ui-verification/SKILL.md), and add a new [session log](../session-log/SKILL.md).
