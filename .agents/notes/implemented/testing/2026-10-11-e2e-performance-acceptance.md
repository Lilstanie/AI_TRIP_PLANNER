# Agent Note: Retain the E2E CLI and add bounded performance acceptance

Status: implemented

## Problem

The raw runner could share a build directory or let an old timeout escalation kill the next journey.
Saved interrupted reports could count as complete coverage. Workspace persistence duplicated catalog
writes, and mounted hidden maps kept their route animation loop. CI did not run the CLI acceptance suite.

## Decision

Keep the existing CLI and Playwright library. Each raw invocation allocates a unique build directory and
owned temporary TypeScript config. Timeouts retain the original child identity and clear escalation on
exit. Reports preserve raw outcomes and classify interrupted attempts as incomplete coverage.

CI runs `node apps/web/tests/cli-e2e/run.mjs` sequentially in its own job with Chromium and lsof. The
wrapper discovers `.e2e.mjs` files plus `report-cli.mjs`, stops at the first failure, records unrun entries
and uploads logs and evidence even on failure for seven days. Existing dotenv files are neither read nor
replaced by the credential-isolation fixture; it creates an unused development dotenv slot exclusively.
The replay journey holds its first request while observing cancellation, then drains background asset
prefetch before entering the offline replay boundary. Later run/artifact assertions still use the server.

Workspace autosave and catalog-only effects share a persistence helper that remembers only the last
successfully written object. Snapshot mirrors, synchronous flush, retry and stale-tab guards remain.
Map panel visibility and reduced motion control the animation separately from route-layer lifetime;
document visibility pauses the loop, while OSM omits unsupported flowing-dash layers.

`node apps/web/tests/e2e/run-performance.mjs` reuses the CLI fixture environment and raw production
runner for workspace and map journeys. It leaves a unique label, logs, JSON, screenshots, workspace
traces and CPU profiles. It supplies a synthetic Google browser key; SDK interception and a real
MapLibre empty style require no live provider calls. The long-history measurement does not change
MessageItem rendering.

## Alternatives considered

- Migrate to Playwright Test now: unnecessary for these defects; retain CLI isolation and evidence contracts.
- Keep fixed build slots with locking: unique directories remove slot contention and stale-lock recovery.
- Unmount hidden maps: loses camera and selection; pausing the loop retains map state.
- Add memo everywhere: defer until the measured long-history path and semantic update dependencies are reviewed.
- Run CLI acceptance concurrently: existing acceptance fixtures replace dependency entrypoints temporarily.

## Consequences

- Raw build directories remain for inspection and consume disk. Each later run allocates a new directory;
  normal exit removes only its own temporary config. SIGKILL can leave that config behind.
- Fixture function-call counts are not React commits or real-user performance metrics. No speedup or
  Core Web Vitals target is established; the second-tab fixture tests the storage protocol, not the edit API.
- The independent CI job adds browser installation and fixture build time. Local runs do not establish
  that Ubuntu/Node 22 CI passed; the workflow must run after publication.
- This supplements the [local CLI decision](2026-10-10-local-test-cli.md),
  [storage decision](../architecture/2026-09-24-workspace-catalog-trip-storage.md) and
  [phone shell](../feature/2026-10-05-phone-shell.md); none is superseded.
- Follow-up candidates and initial evidence remain in the
  [review](../../proposed/testing/2026-10-11-e2e-react-performance-review.md).
