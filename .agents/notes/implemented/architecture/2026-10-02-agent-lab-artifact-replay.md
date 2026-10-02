# Agent Note: Agent Lab artifact download and in-browser replay

Status: implemented
Owner: A (@Lilstanie)

## Problem

A finished Agent Lab run was visible only while its page was open. A reviewer could not keep the
evidence, send it to someone else, or show a past result later without re-running the strategies,
which differ in latency every time. Any way of keeping a run also had to stay inside the experiment's
rules: no server-side run storage, no secrets or raw prompts, and nothing guessed about a file the
page did not produce.

## Decision

A completed run's artifact is saved from the browser exactly as the stream completed with it. The
artifact contract is unchanged: `schemaVersion`, scenario, strategy, data mode, fixture and evaluator
versions, ordered events, plan and metrics, so nothing in `packages/shared` moved.

Replay is also entirely in the browser. `apps/web/lib/agent-lab/replay.ts` reads one chosen file and
accepts it only when it is at most 5 MB, parses as JSON, declares schema version 1, passes
`AgentLabRunArtifact` (contiguous events from 1, event metadata matching the artifact, a valid plan,
`eventCount` matching), has `elapsedMs` that never decreases and spans at most ten minutes, and
records a completed run. Anything else is refused with the reason, and the result already on the page
stays. Fields the contract does not define are dropped by validation, so a raw prompt added to a file
never reaches the page. Accepted events are delivered in order at their recorded offsets from one
clock, then drive the same timeline, plan and metrics views as a live run. The page labels a replay
and names the recorded run. A replay makes no request, so it needs no network and cannot touch saved
chats, trips, preferences or any server state.

The stored metrics are shown as recorded and are not recomputed in the page. The replay E2E asserts
that the replayed evidence equals the original run's.

## Alternatives considered

- **Store runs on the server and replay by id.** Rejected: it needs storage and an identifier a
  visitor could probe, and it would not work offline, which the replay criterion requires.
- **Recompute the metrics while replaying.** Rejected for now: the orchestrator package entry point
  also exports the LangGraph workflow, so importing the evaluator would pull it into the browser
  bundle. The cost is that a file edited by hand shows its edited metrics; the page labels the run as
  a replay of a recorded artifact, and `agent-lab-revision.e2e.mjs` already recomputes every metric
  independently from a live run's plan and trace.
- **Ship a bundled sample artifact.** Not built: a recording goes stale with every fixture or
  evaluator change, and a downloaded artifact already satisfies "select an artifact to replay". The
  `versions` field is how a stale file would be detected if one is added.
- **Replay faster than recorded.** Not built: the criterion is to preserve timing, and runs last
  seconds. Stop replay ends one early.

## Consequences

A visitor can keep and replay evidence without any server cost. Replay trusts the file's own metrics,
so it demonstrates a recording, not a verification. Failed-run artifacts are refused with an explicit
message until the failure work (#105) decides how a failed run replays. A change to the artifact
schema must bump `AGENT_LAB_ARTIFACT_SCHEMA_VERSION`, and the page then refuses older files instead of
guessing.

## Sources

- [Agent Lab strategy and run artifacts](2026-10-01-agent-lab-run-artifacts.md)
- [Agent Lab replay E2E](../../../../apps/web/tests/e2e/agent-lab-replay.e2e.mjs)
