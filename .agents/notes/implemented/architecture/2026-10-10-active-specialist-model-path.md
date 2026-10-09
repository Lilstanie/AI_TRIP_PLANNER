# Agent Note: Keep the active specialist model path and provider construction

Status: implemented

## Problem

The earlier routing decision explicitly retained a structured invoker and its corrective retry.
No runtime or test caller uses that entrance: all five specialists use LangChain agents and
validated structured responses. Keeping two invocation paths obscures the maintained boundary.

## Decision

This supersedes the [earlier model-routing note](../../archived/architecture/2026-09-09-deepseek-model-routing.md).
`MODEL_ROUTING` still defaults every task to DeepSeek. `createRoutedChatModel` retains both
DeepSeek and MiniMax construction, environment configuration and usage callbacks; changing routing
can select the alternate constructor. This cleanup does not establish live MiniMax compatibility
with the current specialist agent loop.

Specialists use `createAgent` and `readStructuredResponse` to validate their own draft schemas,
then retain their existing deterministic fallback on model failure. The unused structured
invoker, its corrective retry and unused reasoning helper exports are removed. Active reasoning
stream assembly, request-scoped model disabling and isolated usage collection remain unchanged.

## Alternatives considered

- Keep the old invoker for future callers: rejected because no maintained consumer exercises it.
- Remove MiniMax construction with the invoker: rejected because the earlier decision preserves
  a second configurable provider; retiring that capability is outside this cleanup.
- Change the default provider: excluded; the earlier decision preferred DeepSeek for latency.

## Consequences

There is one maintained specialist invocation path and fewer exported entrances. Alternate-provider
construction remains available, but live provider behavior still requires opt-in verification.
Schema limits, grounded evidence, reasoning and fallback behavior keep their existing owners.

## Sources

- [Cleanup spec](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/279)
- [Model cleanup ticket](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/282)
