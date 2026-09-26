---
name: agent-experience
description: Design or review AI_TRIP_PLANNER model-facing tools, parameter schemas, prompts, skills and context loading so agents discover the right action and receive enough information with bounded context. Use when changing specialist tools or planning workflows, not for ordinary UI polish.
---

# Agent experience

Make an action easy for a model to discover and use correctly. Start with purpose, available actions
and necessary constraints; load detailed instructions only when they are needed. This is guidance,
not a replacement for the project's behavior and verification rules.

- **Make discovery explicit.** Deferred evidence needs a useful description and a real retrieval
  path. Do not summarize away data that no later tool can retrieve.
- **Keep critical constraints visible.** State permission, destructive effects, quota costs and
  required verification before the relevant action. Keep source kind, price units and uncertainty
  visible where the planner makes its decision.
- **Return bounded results.** Give concise evidence with stable candidate IDs and a supported way to
  request detail. Include adjacent context when it avoids another search. Mark omissions and
  truncation; never imply the model saw every result.
- **Evaluate total work.** A smaller prompt is useful only if it preserves correctness and reduces
  total retrieval, repetition or calls. Distinguish model context from UI-only progress summaries.

## Tool definitions

Describe behavior and returned information, not internal plumbing. Put defaults, ranges, field
relationships and when-to-set rules on the parameter's schema or description. Say each fact once;
do not copy the whole schema into the tool description and system prompt. Omit obvious failure
mechanics, but retain failures or limits that change the model's choice or recovery action.

Trace the actual consumer before editing: specialist tools are defined in
`packages/agents/src/*/index.ts`, delegation tools in `packages/orchestrator/src/supervisor.ts`, and
UI progress decorators in `packages/orchestrator/src/progress-tools.ts`. Read the relevant owner
rather than assuming every wrapper's summary reaches the model. Follow
[architecture](../../../docs/architecture.md) and
[end-to-end-feature-wiring](../end-to-end-feature-wiring/SKILL.md) for boundaries.

For an authorized tool or prompt change, compare first-request prompt tokens when measurement is
available, plus call counts, retrieval and observable outcomes on a fixed task. State missing
measurements. Prefer a repeatable user-path E2E artifact with stubbed providers and no paid quota;
select evidence through [pre-push-checks](../pre-push-checks/SKILL.md). Installing this skill does not
authorize changing prompts, running live providers or removing supported behavior.
