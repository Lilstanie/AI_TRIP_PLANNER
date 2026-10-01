# Agent Note: Agent Lab strategy and run artifacts

Status: implemented
Owner: A (@Lilstanie)

## Problem

Agent behavior was visible only through the product chat, where authentication, mutable workspace
state and provider availability make demonstrations hard to repeat. The project also needed a clear
seam for comparing one-agent and multi-agent strategies without presenting another travel specialist
or exposing private model reasoning.

## Decision

Agent Lab is a public experiment boundary outside the saved workspace. A strict registry accepts
only known scenario, strategy and data-mode identifiers. The first strategy is
`single-agent-baseline` over a fixed Tokyo fixture; it is orchestration above the five domain
specialists, not a sixth specialist.

Runs stream ordered, typed lifecycle envelopes and finish with a schema-versioned artifact containing
the validated `TripPlan`, the same events and deterministic metrics. The envelope may also carry the
existing `AgentProgressEvent` union so later strategies can use one inspector. Public evidence is
limited to bounded summaries; prompts and raw chain-of-thought are not part of the contract. Fixture
runs make no external calls and do not persist workspace or experiment state. Artifacts are a
discriminated completed/failed contract; a failed artifact carries safe structured failure data and
the trace recorded before the failure.

## Alternatives considered

- Reuse `/api/chat`: rejected because its product state, extraction, provider and persistence concerns
  make an experiment less isolated and less repeatable.
- Register the baseline as a sixth specialist: rejected because it compares orchestration strategies
  and does not own a travel domain.
- Render a static recorded JSON file: rejected because it would not exercise cancellation, streaming,
  validation or the browser-to-orchestrator boundary.

## Consequences

`packages/shared` now owns the experiment request, event and artifact contracts, and
`packages/orchestrator` owns the strategy registry and runner. The first slice deliberately supports
one scenario, one strategy and fixture mode; comparison, revision, replay and failure injection add
strategies or event types without replacing the UI boundary. Artifact schema changes require an
explicit version change and coordinated consumer updates.
