# Agent Note: Reduce unused repository surfaces while preserving coverage

Status: implemented

## Problem

The [repository audit](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/279) identified unused exports,
obsolete UI rules and repeated test setup. Removing these independently risks losing regression coverage
or reviving a superseded architectural decision.

## Decision

Issues #280–#289 remove confirmed unused web templates, helpers, demo services, model invocation code,
a planning dependency edge, obsolete trip styles and Android identity overrides. Clerk authorization,
account/storage services, active structured agent output, provider snapshots, saved data and Android
manifest classes remain. [Active specialist model routing](../architecture/2026-10-10-active-specialist-model-path.md)
owns the superseded invoker decision; alternate model construction remains available.

Three small internal helpers own repeated place-name matching, place-route error mapping and trip E2E
setup. Domain schemas, grounding and dietary checks stay with their specialists; route validation,
provider provenance, redirects and cache headers stay with their routes. Held-response orchestration,
cancellation and scenario assertions stay local to each E2E script. Place details/photo provider
unavailability returns 503 before the generic authored-refusal 404 branch; failure-first regressions
cover that subclass ordering.

The following map owns every assertion removed during consolidation. Other checks remain in their
original scripts; no trip scenario assertion or screenshot is removed.

| Removed repetition                                                   | Surviving owner                                                                                            | Boundary retained                                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `map-fallback` direct details HTTP 200/name/no-rating compound check | `map-provider-http` concurrent details and language-separated English details; `map-fallback` visible card | HTTP status, Kyoto Station name, absent fabricated rating, visible fallback presentation |
| Release per-profile outcome/figure checks for four additional faults | `agent-lab-failures` five-profile loop                                                                     | Independently recomputed outcomes, labels and figures for every registered fault         |
| Release downloads and offline replay for those four faults           | `agent-lab-failures` download/replay loop                                                                  | Download equals streamed artifact; offline outcome and run ID survive                    |
| Release Run all and repeated no-storage check                        | `agent-lab-failures` Run all, cancellation and storage-isolation checks                                    | Sequential execution, cancellation and workspace storage isolation                       |

`agent-lab-release` retains `provider-empty-result` outcome/download/offline replay and the benchmark,
cross-view, workspace-isolation, leak and accessibility/layout matrix. The full fault matrix still
belongs to `agent-lab-failures`. This partly supersedes only the test scope of the
[public-release decision](../feature/2026-10-02-agent-lab-public-release.md); its UI and accessibility
rationale still applies. Route-from-location, cycling persistence and mixed-provider outage journeys
remain in `map-fallback` because they exercise distinct boundaries.

## Alternatives considered

- Keep all candidates: retains documented unused surfaces and duplicated setup.
- Consolidate broad modules or replace the testing framework: expands scope and obscures existing
  regression ownership.
- Delete every repeated browser path: loses the distinct HTTP/UI and cross-view boundaries above.

## Consequences

The inventory below measures the surface-reduction scope through `d6d52e8`; the subsequent
[comment cleanup](2026-10-10-code-comment-cleanup.md) is a separate change.

Against baseline `42fded7`, the tracked code inventory (TS/TSX/JS/JSX/MJS/CJS/CSS/Java, including tests,
tooling and submission builders; blank lines/comments included) falls from 475 files / 89,208 physical
lines to 474 / 88,474: one fewer file and 734 fewer lines. The total includes the new 29-line route
error helper, 20-line place-name helper, 119-line trip setup helper, imports and 34 added regression
lines plus a four-line deterministic Date setup for existing route tests. The test clock keeps the
fixed departure fixture within its supported window without changing production validation; five
additional lines come from formatting the touched test file. Explicit
DST and out-of-window test clocks still override it. Documentation, notes and generated lock metadata are outside this code count; the PR diff
reports their additional cost. No runtime speed improvement is inferred from line reduction.

Existing runner names, artifact paths and the dedicated five-fault script remain. Browser evidence
belongs in ignored `output/e2e/` and `output/playwright/`; actual combined results and commands belong
in the session log and PR. Browser fixture and HTTP-stub checks do not establish live provider behavior,
paid-model behavior or physical Android launch/orientation/delegation. Android compilation also needs
a configured Android SDK. Skipped or blocked checks must remain explicit.

## Sources

- [Parent specification](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/279)
- [Combined acceptance ticket](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/290)
- [Existing E2E entry points](../../../../docs/development.md#testing-approach)
- [Map fallback journey](../../../../apps/web/tests/e2e/map-fallback.e2e.mjs)
- [Provider HTTP journey](../../../../apps/web/tests/e2e/map-provider-http.e2e.mjs)
- [Complete fault matrix](../../../../apps/web/tests/e2e/agent-lab-failures.e2e.mjs)
