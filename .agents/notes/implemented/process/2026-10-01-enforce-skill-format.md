# Agent Note: Enforce the skill format in verify:docs and CI

Status: implemented
Owner: A (@Lilstanie)

## Problem

Skills under `.agents/skills` drifted from the SKILL.md format: eleven supporting documents sat beside
`SKILL.md`, references linked to other references, and thirteen descriptions said when to use a skill
but not what it does. `verify:docs` only checked that a skill had a name matching its folder and some
description, so nothing stopped the next skill from drifting the same way.

## Decision

`scripts/skill-rules.mjs`, called from `scripts/verify-docs.mjs`, checks what a script can decide, in two tiers.

Failing rules: a lower-case kebab-case `name` of at most 64 characters that matches the folder; a
`description` of at most 1,024 characters that says when to use the skill; `compatibility` of at most 500
characters; supporting files only under `references/`, `scripts/` and `assets/` plus a licence file; and no
link from a reference to another reference or from a `SKILL.md` into another skill's references. The first
three are requirements of the [Agent Skills specification](https://agentskills.io/specification), and the
rest are this project's conventions, which are stricter than the specification (it allows any file beside
`SKILL.md`) so that every skill is laid out the same way.

Advisories, printed by `verify:docs` without failing it: a `SKILL.md` over 500 lines (the specification
recommends staying under it), name, description and `when_to_use` over 1,536 characters together (the
trigger budget Claude Code shows per skill, from the format guide at https://qiao1.top/posts/fcc443a7.html),
and frontmatter fields the script does not know. These are recommendations or client-specific limits, so a
long but valid skill is never blocked, and each is one constant or list in the script.

The rules have their own node tests (`pnpm test:scripts`), and CI runs them after `pnpm test`, so a change
to the rules cannot silently weaken the check.

Rules that need judgement are not enforced: which rule is the most important and belongs first, whether
an operation is deterministic enough to become a script, and whether a skill teaches the model something
it already knows. Those stay in review.

## Alternatives considered

**Make every rule a failure.** Rejected: the 500-line and 1,536-character figures are guidance, not
requirements, and blocking a valid skill on them would teach people to ignore the check.

**Keep the weaker check and rely on review.** Rejected: the drift went unnoticed until someone read the
guide against every skill.

**Put the rules inside `verify-docs.mjs`.** Not chosen: a separate module can be tested on its own
fixtures without running the whole documentation check.

**Run the rule tests only by hand.** Rejected: the rules would be the one part of the check nobody
verifies after the next edit.

## Consequences

A skill that breaks one of the rules fails `pnpm verify:docs` and CI. Adding a field the guide permits
means adding it to the known-field list in `scripts/skill-rules.mjs`. The CI workflow and the root
`package.json` changed with the owner's explicit approval.
