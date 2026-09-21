# Agent Note: Every proposal reports where its data came from

Status: implemented
Owner: A (@Lilstanie)

## Problem

When a specialist's model or provider call failed, it fell back to deterministic output, but the
plan still labelled the section from the `USE_MOCK_TOOLS` setting and the section id. With live mode
on, a degraded section told the user its data was real at exactly the moment it was not.

## Decision

`AgentProposal.source` in `packages/shared/src/contracts.ts` carries a required `kind`: `live`,
`estimated`, `mock`, `fallback` or `unavailable`, plus a label and freshness. Each specialist
sets `kind` in the branch that actually ran, including its fallback `catch` branch. The
orchestrator only fills a default when a proposal has no source. TripSection, ChatPanel and result
cards show the kind and a high-level reason, never prompts or reasoning.

## Alternatives considered

**Keep deriving the label in the workflow from the environment.** Rejected: it describes the
configuration, not what the agent did, and is wrong whenever a call degrades.

**A separate provenance system.** Rejected: the existing `source` field already reached every
consumer; adding `kind` touched four places.

## Consequences

- A new specialist or fallback branch must set `kind`; otherwise the default label can overstate
  the data.
- Adding `kind` was a `packages/shared` contract change.

## Sources

Archived [product closure TODO](../../../archive/todo-product-closure.md) (PR #31,
`fix/degraded-visibility`).
