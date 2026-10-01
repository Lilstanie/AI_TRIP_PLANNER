# Agent Note: Remove the project-local grill-with-docs skill

Status: implemented
Owner: A (@Lilstanie)

## Problem

The project carried its own `grill-with-docs` skill, adapted from the Matt Pocock collection by the
[earlier decision](../../archived/process/2026-09-26-matt-pocock-skills.md). The owner works in Claude
Code and Codex, where the upstream `grill-with-docs` skill is already installed, and never used the
project-local copy. Two skills with the same name and purpose leave an agent unsure which one applies,
and each description spends part of the budget every session shares.

## Decision

Delete `.agents/skills/grill-with-docs`. Requirement interviews come from the upstream skill the owner
installs in their own tools, which reads this repository's `docs/agents/` configuration (issue tracker,
labels and domain docs) described in
[the engineering skills configuration](2026-10-01-engineering-skills-repository-configuration.md).

The earlier note is archived because half of it is reversed. Its other decision stands and is restated
here: keep the project-local `diagnosing-bugs` adaptation, which follows this project's E2E-first
validation, instead of installing the whole upstream collection unchanged.

## Alternatives considered

**Keep the skill.** Not chosen: it duplicates the upstream skill and has no user.

**Replace it with a stub that points at the upstream skill.** Rejected: a skill whose only job is to point
elsewhere still costs description budget in every session, and the pointer belongs in the development
guide.

## Consequences

An agent in a tool without the upstream collection no longer has a project-local requirements interview;
it falls back to ordinary clarifying questions. The development guide and the third-party notice no
longer list the skill. The `docs/agents/` configuration stays, because it configures the upstream skills
rather than the deleted one.
