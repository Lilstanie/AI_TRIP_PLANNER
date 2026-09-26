# Agent Note: Project simplification and prose skills

Status: implemented

## Problem

The existing skills guide feature delivery, review and interface writing. They do not provide a
focused method for evaluating removal of maintenance obligations or editing technical prose without
losing behavior and failure guarantees. DeepSeek Harness has both workflows, but its package layout,
documentation gates, Cordis and bilingual rules do not describe this repository.

## Decision

Adapt DSH's `dsh-find-simplifications` and `dsh-prose-standard` as project-local
[find-simplifications](../../../skills/find-simplifications/SKILL.md) and
[prose-standard](../../../skills/prose-standard/SKILL.md). The former traces actual producers and
consumers, accounts for capability losses and separates surveys from implementation authority. The
latter preserves complete factual propositions and adds missing guarantees as well as trimming prose.

The skills use this project's package layout, truthful provenance, AUD accounting, cancellation,
snapshot handling, E2E preference, protection rules, documentation ownership and note lifecycle.
References are read on demand. No DSH-only command, unconditional delegation requirement, locale
dictionary requirement or runnable-snapshot gate is imported.

This extends the [repository workflow skills decision](2026-09-22-repository-workflow-skills.md)
without replacing it. The feature-wiring, code-review and better-writing skills retain their roles.
`agent-experience` is explained to the user but is not installed by this change.

## Alternatives considered

**Copy the DSH skills unchanged.** Rejected: their paths, gates and protected architectural choices
would misdirect work here.

**Fold them into code-review and better-writing.** Not chosen: a simplification survey evaluates
removal before a diff exists, and technical prose includes API failures and ordering beyond UI voice.
The focused workflows link to existing owners instead of duplicating their standards.

## Consequences

Two project skill entrypoints and their references need maintenance when the rules or named owners
change. Installation does not authorize a code cleanup, rewrite, deletion or live API call. Future
implementations use the existing validation workflows; this skill-only change needs documentation,
protection and formatting checks rather than application E2E.

## Sources

- DeepSeek Harness checkout `477b4f420553e8a52c2fbccc464d7561b239c443`:
  [simplifications](https://github.com/deepseek-ai/deepseek-harness/blob/477b4f420553e8a52c2fbccc464d7561b239c443/.agents/skills/dsh-find-simplifications/SKILL.md)
  and [prose](https://github.com/deepseek-ai/deepseek-harness/blob/477b4f420553e8a52c2fbccc464d7561b239c443/.agents/skills/dsh-prose-standard/SKILL.md).
- Attribution and MIT licence: [third-party notices](../../../skills/THIRD_PARTY_NOTICES.md).
