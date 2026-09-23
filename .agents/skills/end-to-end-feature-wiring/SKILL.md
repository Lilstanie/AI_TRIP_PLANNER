---
name: end-to-end-feature-wiring
description: Use when implementing a feature that crosses package, port, agent, persistence, streaming, or UI boundaries, or when existing data or behavior is produced but does not reach its intended consumer.
---

# End-to-end feature wiring

Trace the behaviour from its source to the place that consumes it. A working adapter or calculation does not complete a feature if a wrapper, contract, exception path or UI drops its result.

1. State the expected behaviour in user-visible terms, then locate the producer and final consumer.
2. Trace the value across every boundary in between: provider adapter, typed port, decorators or wrappers, orchestrator, agent, shared contract, persistence or stream event, and UI as applicable. Search all implementations and call sites of changed port methods and fields.
3. Inspect every wrapper that reconstructs a typed object. Preserve the original interface and override only the behavior being decorated; prefer spreading the original object over maintaining a parallel method list. Add a focused test proving newly added methods and values pass through the wrapper.
4. Check that useful data is retained after validation or conflict checks and reaches the consumer. Cover exceptional and early-return paths too, especially when state is persisted only for one response type.
5. Test the boundary where the value could be lost, then verify the complete user-visible path when the change crosses into the app. For provider-specific constraints, follow [add-provider](../add-provider/SKILL.md); for visible UI changes, follow [ui-verification](../ui-verification/SKILL.md).
6. If the change affects a shared contract or records a lasting workflow decision, follow [agent-notes](../agent-notes/SKILL.md). Keep the relevant docs, skill and session log in step with the change.
