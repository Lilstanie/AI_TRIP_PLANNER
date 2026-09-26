# Agent Note: Selected Matt Pocock skills adapted for this project

Status: implemented

## Problem

The project has skills for feature wiring, code review, UI verification and agent-facing product design, but no focused workflow for clarifying uncertain requirements before implementation or building an evidence loop for hard bugs. Adopting the full upstream collection would duplicate project skills and bring workflow assumptions that conflict with the repository's documentation and testing rules.

## Decision

Adapt two workflows from [mattpocock/skills](https://github.com/mattpocock/skills) into project-local skills: [grill-with-docs](../../../skills/grill-with-docs/SKILL.md) and [diagnosing-bugs](../../../skills/diagnosing-bugs/SKILL.md). The first interviews only about material open decisions, verifies facts against the repository, and records durable decisions in existing `docs/` and Agent Notes. The second narrows a reproducible symptom, tests explanations against evidence, and prefers repeatable E2E validation for user-visible behavior.

The skills follow this project's decision-round style, bilingual documentation requirements, protected-file rules, E2E preference, failure-inventory rule for isolation checks, and session logging. They complement rather than replace `agent-experience`, `end-to-end-feature-wiring`, `code-review`, `ui-verification`, and `pre-push-checks`. Attribution and the MIT licence are in [THIRD_PARTY_NOTICES.md](../../../skills/THIRD_PARTY_NOTICES.md).

## Alternatives considered

**Install the full upstream collection unchanged.** Rejected: it overlaps existing workflows and includes defaults such as TDD-first validation and a separate `CONTEXT.md`/ADR structure that do not match this repository.

**Use only the upstream `grill-with-docs` entrypoint unchanged.** Rejected: it delegates to upstream `grilling` and `domain-modeling` workflows whose command surfaces, document layout and confirmation gates are not the project's conventions.

**Keep the current skills only.** Not chosen: they do not provide a dedicated decision interview or a hard-bug evidence loop.

## Consequences

Two new skill entrypoints need maintenance when the repository's testing, documentation or feature-boundary rules change. The development guide lists their roles in English and Chinese. These skills do not authorize unrelated implementation, and diagnosis must report evidence limits when a repeatable loop is unavailable.

## Sources

- [Matt Pocock skills repository](https://github.com/mattpocock/skills), adapted at commit `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`: `grill-with-docs`, `grilling`, `domain-modeling`, and `diagnosing-bugs`.
- [E2E-first testing decision](../testing/2026-09-25-e2e-first-testing.md).
- [Repository workflow skills decision](2026-09-22-repository-workflow-skills.md).
