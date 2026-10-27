# Agent Note: Model access requires authentication on deployments

Status: implemented
Owner: A (@Lilstanie)

## Problem

The provider data mode does not control model calls. Anonymous chat could call a model even when it
used fixture data, and Agent Lab could allow anonymous live runs when its operator enabled them.

## Decision

On deployments, real model access requires a signed-in traveller. Chat uses deterministic fallbacks
when authentication blocks live access. Agent Lab refuses live runs at its route boundary. Local
development without configured authentication retains model access. Provider data mode remains
independent: signed-in travellers can use a model while provider data is mock.

This partly supersedes the anonymous-live access decision in the [Agent Lab gate note](2026-10-02-agent-lab-live-gate.md).

## Alternatives considered

- Require sign-in for all workspace features: rejected so visitors can try fixture-backed planning.
- Disable models for every mock-data request: rejected because signed-in travellers may combine a
  real model with fixture providers.

## Consequences

Anonymous deployed chat has less capable rule-based responses. Agent Lab fixture runs remain public;
live runs also retain their separate enablement and per-process limits. Daily per-user quotas remain
out of scope.

## Sources

- [Issue #440](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/440)
