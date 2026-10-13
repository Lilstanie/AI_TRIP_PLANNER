# Agent Note: Extend the E2E runner for local testing

Status: proposed

## Problem

The web E2E runner already starts and stops its own server, accepts script patterns and writes a JSON
summary. Environment diagnosis, repeat execution and evidence discovery still require knowledge of
individual scripts. Some scripts reuse fixed evidence directories. Mock tool data does not disable
model calls, and the runner's required-key skip mechanism has no declarations in current scripts.
A successful process exit alone therefore does not prove that every requested check executed.

## Proposal

Extend `apps/web/tests/e2e/run.mjs` through the confirmed entry point
`pnpm --filter @trip/web e2e`. Keep the tool repository-local, for developers and coding agents,
with readable output and `--json`. Reuse existing server lifecycle and script execution code;
retain scenario assertions and cancellation setup in their existing scripts.

| Subcommand | First-version responsibility                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| `doctor`   | Check local dependencies and configuration without starting servers or calling services.                        |
| `list`     | List scripts, prerequisites, local support and reasons a script is unsupported.                                 |
| `run`      | Execute curated smoke by default, named supported scripts or all supported local scripts; allow serial repeats. |
| `report`   | Read one invocation's saved JSON summary and show its evidence paths.                                           |
| `cleanup`  | Remove only that invocation's owned temporary resources; preserve reports and evidence.                         |

The new `run` command defaults to `next build` followed by `next start`, with an explicit development
mode option. Existing raw named-script commands keep their current syntax and behavior. They do not
inherit the new local-isolation guarantee merely because they share the same entry point.

Start with a small explicitly supported set of complete local scenarios. Before inclusion, verify that
every required assertion executes with deterministic fixtures and without real models or paid
providers. Mixed local/model scripts and scripts requiring multiple servers remain unsupported in the
first version, with a stated reason. Do not build a universal subcheck protocol or adapt every script.
The exact supported set and smoke members remain to be selected from evidence; this note makes no
coverage or runtime claim for an unverified collection.

The new local mode owns its test server and does not silently reuse inherited `BASE_URL`. It must
prevent real model/provider, database, KV and authentication credentials from activating external
services, including values Next.js loads from app environment files. Tool mock mode and clearing
inherited keys alone are insufficient. Use local fixture state without editing credential files or
touching user data. The concrete environment isolation mechanism must be verified before this mode
is considered usable.

Give each invocation one evidence directory, an attempt directory for each repeat and one JSON
summary recording the requested checks, statuses, reproduction commands and evidence paths. `report`
reads that summary directly; no report service, database or index is needed. Repeats run serially
with fresh browser contexts and independent fixture/test state, resetting owned server state where
needed. Separate output directories alone do not establish execution isolation. Preserve every
attempt and make the overall result nonzero if any required check fails, times out or cannot execute;
later success cannot hide an earlier failure. There is no automatic retry or new parallel scheduler.

An explicitly requested unsupported script returns nonzero with its reason. A script that silently
skips required assertions is not eligible to be reported as passing. Cleanup on completion, timeout,
interruption or explicit request affects only resources owned by that invocation; reports, diagnostic
evidence and unrelated processes remain intact.

Implementation remains paused at the user's request. This revision changes the design only, adds no
package script and approves no smoke membership. Select the initial scenarios and verify their
isolation and evidence paths before implementation; do not introduce a new CLI framework or dependency
unless the existing runner and platform APIs prove insufficient.

Do not add comments when writing code for this work. Express intent through clear names and code
structure; record design rationale and usage instructions in documentation.

## Alternatives considered

- A full troubleshooting CLI including provider credentials, database queries and migrations: deferred;
  the user chose local testing as the first scope.
- An agent-only interface or a distributable team tool: deferred; the user chose a repository-local
  tool shared with the developer.
- Real-model calls with fixture tools by default: declined in favor of deterministic local execution.
- Every local E2E or mandatory explicit script names as the default: declined in favor of curated smoke.
- Exit successfully when requested checks are unavailable: declined; required coverage must execute.
- A separate CLI package, report database, parallel scheduler or universal script/subcheck framework:
  unnecessary for the initial scope; extend the existing runner and support verified scenarios first.

## Acceptance criteria

- Environment checks and test discovery do not start test servers or invoke paid services.
- Default smoke, named supported scripts and all supported local scripts execute through the CLI and
  leave repeatable evidence; unsupported scripts have explicit reasons in discovery output.
- The new run path uses production mode by default and supports explicit development mode.
- Repeated execution isolates both state and evidence, records every attempt and returns nonzero if
  any required attempt fails, times out or is blocked, even when a later attempt passes.
- The new local mode owns its server, ignores inherited `BASE_URL` and cannot activate external
  services through inherited credentials or app environment files.
- Failures, timeouts, blocked prerequisites and explicitly requested unsupported scripts return
  nonzero with distinct statuses. Exit zero cannot conceal skipped required assertions.
- Result lookup reads one saved summary and resolves its evidence without a separate query service.
- Interrupt and timeout cleanup affects only owned resources and preserves diagnostic evidence.
- Existing documented raw E2E commands remain usable with their existing behavior.

## Risks

- Many scripts write fixed output paths; supported scenarios need verified per-attempt destinations.
- Clearing inherited keys alone does not establish isolation from Next.js environment loading.
- Existing known failures must be reported, not removed to obtain a green smoke result.
- Production builds add startup cost; measure it before promising a smoke runtime or adding caching.
- Some scripts need local HTTP stubs or multiple separately configured servers; a small supported set
  limits initial coverage, and discovery must make those exclusions visible.
- A CLI wrapper must not replace scenario assertions with process-exit checks alone. Scripts with
  internal skips remain unsupported until all required local assertions can be verified.

## Sources

- [Published specification](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/293)
- Implementation tickets: [isolated named execution](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/294),
  [preflight and discovery](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/295),
  [local collections](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/296),
  [serial repeats](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/297),
  [saved reports](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/298) and
  [owned-resource cleanup](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/299).
- [Development and existing E2E commands](../../../../docs/development.md#testing-approach)
- [Existing runner](../../../../apps/web/tests/e2e/run.mjs)
- [Known E2E failures](../../../../docs/e2e-known-failures.md)
- [E2E-first policy](../../implemented/testing/2026-09-25-e2e-first-testing.md)
- [Coverage ownership and evidence boundaries](../../implemented/simplification/2026-10-10-repository-surface-reduction.md)

This proposal preserves the E2E-first policy and scenario ownership decisions; it does not supersede
an implemented decision. The dated policy's statement that no E2E suite exists describes its original
baseline, not the current checkout.
