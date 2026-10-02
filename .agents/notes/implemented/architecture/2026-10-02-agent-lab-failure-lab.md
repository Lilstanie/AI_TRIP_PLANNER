# Agent Note: Agent Lab Failure Lab

Status: implemented
Owner: A (@Lilstanie)

## Problem

Agent Lab could show a healthy run and an infeasible request, but not what the workflow does when
something it depends on breaks. A reviewer could not see where a failure occurred, whether the workflow
carried on with less, kept a partial result or stopped, or how that changed the measured figures. The
public endpoint also could not offer failures at all without becoming a way for a visitor to break
arbitrary parts of the system, or to fabricate a failure no real run would produce.

## Decision

A fault is a registered profile, not something a visitor defines. `AgentLabFaultProfileId` in
`packages/shared` has five values, and `AgentLabRunRequest` accepts an optional `faultProfileId`.
`packages/orchestrator/src/agent-lab/fault-profiles.ts` binds each profile to the one scenario and
strategy it was built for, and `isRegisteredAgentLabRun` is the gate: the route returns the same 400 for an
unknown id, an object that defines a fault, an extra property or any other combination.

Faults are wrappers in `faults.ts` around the specialists the workflow already runs, applied outside the
trace wrapper so they flow through the same progress tools and the same proposal validation. Each one is
what the workflow was observed to do, found by probing every provider call against every specialist:

| Profile                 | Injected into               | Observed result                                                          |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `provider-timeout`      | transport's flight search   | Section `unavailable` and unpriced, a conflict stays; the run carries on |
| `provider-empty-result` | accommodation's stay search | The specialist throws rather than invent a stay; the run stops           |
| `invalid-agent-output`  | dining's proposal           | Rejected at the proposal schema; the run stops                           |
| `supervisor-failure`    | the supervisor              | Falls back to deterministic dispatch; the run completes                  |
| `stalled-revision`      | transport's revision        | Best known plan kept, `no_improvement`; the run completes                |

Two optional facts and one option were added to the workflow, none changing its behaviour:
`agent_output_rejected` (field paths only) and `delegation_fallback` decisions, and
`OrchestratorOptions.supervisorModel`, which makes injected specialists delegate through a given model.
The supervisor fault uses a scripted model that delegates to nobody, so the workflow's own check for the
day plan fails and it falls back. The lab turns the decisions into `lab_agent_output_rejected` and
`lab_supervisor_fallback` events, and the runner opens a faulted trace with `lab_fault_injected`.

A run a fault stops ends in a failed artifact, built by `runAgentLabToArtifact`. It keeps the events
recorded before the failure and names the failing specialist (`failure.code` `agent_failed`,
`failure.agent`) with a message that carries no stack, validator text or provider payload. The artifact
records `faultProfileId`, which is `null` for an ordinary run. These are optional or defaulted additions, so
every earlier artifact still parses and `AGENT_LAB_ARTIFACT_SCHEMA_VERSION` stays 1.

How a run ended is read from the artifact alone, by `apps/web/lib/agent-lab/fault-outcome.ts`: Failed for a
failed artifact; otherwise Degraded for a supervisor fallback or a failed tool call, Partial result for a
`no_improvement` stop, and Completed. Nothing else feeds it, so a live run, a download and a replay of that
download read the same. A failed artifact downloads and replays like any other.

## Alternatives considered

- **Let a visitor choose the tool, the error or the specialist.** Rejected: the public endpoint would become
  a way to break anything, and the result would not be repeatable evidence.
- **Make every fault degrade gracefully.** Rejected: the workflow does not. The accommodation specialist
  throws when its stay search fails or returns nothing, and the destination and dining specialists throw when
  their place search fails. Showing the real terminal behaviour is the point, and inventing a recovery would
  present fiction as a feature.
- **Intercept faults inside the production workflow.** Rejected: wrappers outside the trace wrapper reuse the
  same boundaries without a test-only branch in the workflow.
- **Add outcome and failure counts to the metrics contract.** Rejected: they are determined by the trace, so
  deriving them keeps one source of truth and avoids a schema version change.
- **Show a failed run as an error alert.** Rejected: for a fault the stop is the expected outcome, so the card
  shows it as a result and the page's own error state stays for real failures.

## Consequences

Visitors can see the five ways a fault ends, with the evidence kept and replayable. The registry is
repeatable only while the mock booking and maps fixtures and the specialists' own fallbacks stay as probed,
and the tests fail if one changes. The supervisor fault depends on the workflow's check that the day plan was
not skipped. The faulted runs still rely on an environment with no provider keys, like every fixture run.

## Sources

- [Agent Lab strategy and run artifacts](2026-10-01-agent-lab-run-artifacts.md)
- [Artifact download and replay](2026-10-02-agent-lab-artifact-replay.md)
- [Fault tests](../../../../packages/orchestrator/tests/agent-lab-faults.test.ts)
- [Failure Lab E2E](../../../../apps/web/tests/e2e/agent-lab-failures.e2e.mjs)
