# Agent Note: Route specialist models to DeepSeek, keep MiniMax wired

Status: implemented
Owner: A (@Lilstanie)

## Problem

Specialists can call either DeepSeek or MiniMax. MiniMax initially failed with HTTP 401, and after
the endpoint was fixed it still returned prose instead of structured output, because it ignores a
forced `tool_choice`. Once both worked, the choice of provider decided page latency.

## Decision

`MODEL_ROUTING` in `packages/agents/src/models.ts` routes every specialist to DeepSeek.
`createRoutedStructuredInvoker` keeps both branches: DeepSeek uses `withStructuredOutput`;
MiniMax binds the tool with `tool_choice: "auto"` and validates the arguments against the same
Zod schema. Both retry once with the validation failure fed back. Changing one entry in
`MODEL_ROUTING` routes a task back to MiniMax.

## Alternatives considered

**Route to MiniMax.** Its drafts were comparable, but each structured call took 15–25 s. Measured
full page renders were 37–81 s on MiniMax against 15–23 s on DeepSeek.

**Delete the MiniMax branch.** Rejected: it is small, tested and working, and keeps a second
provider available if DeepSeek degrades.

## Consequences

- Planning latency and quality depend on one provider by default.
- Numeric schema limits are treated as advisory by both providers, so prompts restate hard limits
  and every response is validated.
- MiniMax keys are region-specific: a mainland-China key only works against the mainland host.

## Sources

[2026-09-09 MiniMax endpoint log](../../../session-logs/2026-09-09-minimax-endpoint-fix.md)
