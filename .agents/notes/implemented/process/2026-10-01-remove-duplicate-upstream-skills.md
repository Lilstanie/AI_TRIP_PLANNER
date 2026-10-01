# Agent Note: Remove the project-local skills that duplicate upstream ones

Status: implemented
Owner: A (@Lilstanie)

## Problem

The project carried two skills adapted from the Matt Pocock collection by the
[earlier decision](../../archived/process/2026-09-26-matt-pocock-skills.md): `grill-with-docs` and
`diagnosing-bugs`. The owner works in Claude Code and Codex, where the upstream skills of the same names
are already installed, and never used the project-local copies. Two skills with the same name and purpose
leave an agent unsure which one applies, and each description spends part of the budget every session
shares. The only project-specific content, the E2E-first testing preference, already lives in the root
`CLAUDE.md` testing rules, which every skill and every session reads.

## Decision

Delete `.agents/skills/grill-with-docs` and `.agents/skills/diagnosing-bugs`, and with them the Matt Pocock
licence notice, since no adapted text remains. Requirement interviews and bug diagnosis come from the
upstream skills the owner installs in their own tools, which read this repository's `docs/agents/`
configuration (issue tracker, labels and domain docs) described in
[the engineering skills configuration](2026-10-01-engineering-skills-repository-configuration.md).

The earlier note is archived because its decision is now fully reversed.

## Alternatives considered

**Keep the skills.** Not chosen: they duplicate the upstream skills and have no user.

**Keep `diagnosing-bugs` for its E2E-first wording.** Rejected: that preference is stated once in
`CLAUDE.md` and applies to any skill, so a copy of the skill adds only a second place to maintain.

**Replace them with stubs that point at the upstream skills.** Rejected: a skill whose only job is to point
elsewhere still costs description budget in every session.

## Consequences

An agent in a tool without the upstream collection has no project-local requirements interview or
debugging workflow; it relies on ordinary clarifying questions and the testing rules in `CLAUDE.md`. The
development guide and the third-party notice no longer list the skills. The `docs/agents/` configuration
stays, because it configures the upstream skills rather than the deleted ones.
