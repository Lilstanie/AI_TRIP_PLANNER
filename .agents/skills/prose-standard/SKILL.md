---
name: prose-standard
description: Write, review, restore or trim AI_TRIP_PLANNER documentation, JSDoc, comments, skills, prompts and diagnostics while preserving every behavior, failure, timing and ownership promise. Use for prose audits and technical writing; use better-writing for interface voice and terminology.
---

# Prose standard

Write enough to preserve the reader's required facts, then remove reasoning transcripts, repetition
and decoration. A shorter passage is useful only when it stays accurate and becomes clearer. This
is guidance, not a script. [docs/AGENTS.md](../../../docs/AGENTS.md) owns documentation placement;
[better-writing](../better-writing/SKILL.md) owns interface voice and terminology.
For ordinary `docs/` pages, [translate-docs](../translate-docs/SKILL.md) keeps both languages current
in the same edit; preserving a proposition also means preserving it in the counterpart.

## Scope and authority

Use the user's named file, diff, component or document as scope. Do not infer a repository-wide
audit. When a missing scope blocks the work, ask for it; continue any independent work already
scoped. Automatic mode is the default. Ask about editorial alternatives only when the user requests
interactive calibration or the unresolved choice materially affects the result.

A review reports findings. A write, fix or trim request authorizes clear edits in scope. Respect
protected files and frozen history in [AGENTS.md](../../../AGENTS.md): do not edit dated session
logs, archives, rejected notes or archived notes. Exclude third-party dependency and generated output
from prose edits. Edit the owning source before regenerating a derivative through its normal tool.

## Preserve the complete proposition

Before trimming, identify the actor, action, condition, timing, ordering, must/may/never, exception,
ownership, side effect, failure and consequence. Preserve every relevant fact. Do not turn an
unknown price into zero, a fallback into live data, a request to abort into completed cancellation,
or a fixed-rate conversion into a current exchange rate.

Keep behavior and failure guarantees where callers need them. Link architecture, algorithms,
rationale, history and long examples to their owner. One explanation has one home; essential local
guarantees may appear at their point of use. Keep searchable technical names when they state the
subject precisely. Remove a control-flow transcript entirely when the code already says it.

## Coverage by location

- **JSDoc and module comments:** state non-obvious returns, failures, ownership, timing, cancellation
  and side effects. Orient complicated code without narrating each helper or branch.
- **Tests and examples:** explain a non-obvious fixture or observation, and preserve prerequisites,
  the real entry path and how to verify the result. Do not restate every assertion or invent tests
  as an editorial task.
- **READMEs and docs:** describe current configuration, behavior, limits and failures. Link the
  owning page instead of copying its command table or rationale. Maintainer traps belong here;
  cleanup inventories belong in a proposal.
- **Agent Notes:** preserve rationale, alternatives, consequences and verification evidence.
  Update implemented facts without reversing the decision; use
  [agent-notes](../agent-notes/SKILL.md) for supersession.
- **Skills:** keep discriminating triggers, scope, non-obvious guardrails and discoverable references.
  Delete repeated persuasion, not the rule that limits how the workflow is used.
- **Configuration comments and diagnostics:** explain load order, surprising defaults or a violated
  rule and its correction. Let the configuration show its own inventory.
- **Prompts and visible strings:** wording changes behavior. Inspect the actual tool schema, prompt
  owner or UI consumer, including labels, errors and accessibility names. An audit may flag a stale
  capability claim; changing it requires behavioral evidence, not just a shorter sentence. Follow
  [better-writing](../better-writing/SKILL.md) and
  [ui-verification](../ui-verification/SKILL.md) for visible changes.

## Work and verify

Read the owning code or document before judging prose. Use `rg` to find analogous passages, then
classify them as keep, add, trim, restore, restructure or defer. Apply only authorized edits; do not
manufacture a change to meet a word-count target. For calibration, read
[examples](references/examples.md).

When two versions preserve all facts but trade readability against locally necessary detail, choose
the clearer one and report a consequential deferral. If the user requests calibration, offer viable
alternatives and explain their actual difference. Do not weaken a proposition just to proceed.

Select checks with [pre-push-checks](../pre-push-checks/SKILL.md). Prefer E2E evidence for a changed
user flow and leave a repeatable artifact; do not write unit tests after code. Report the inspected
scope, changes, deliberate keeps, deferrals and commands actually run. Add a new
[session log](../session-log/SKILL.md) after edits.
