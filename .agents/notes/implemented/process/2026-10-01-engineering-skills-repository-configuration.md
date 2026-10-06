# Agent Note: Configure repository metadata for engineering skills

Status: implemented

## Problem

Engineering skills that create or consume tickets, triage work, and model the domain need a stable
repository-level description of the issue tracker, triage vocabulary, and domain-document layout.
The repository previously adapted only two Matt Pocock workflows and deliberately avoided their
separate context and ADR convention, so enabling the broader configuration requires an explicit
decision instead of silently changing that boundary.

## Decision

Repository-level engineering skill configuration lives under `docs/agents/`. GitHub Issues in
`Lilstanie/AI_TRIP_PLANNER` are the issue tracker, the five canonical triage labels map directly to
same-named GitHub labels, and pull requests are not a triage request surface.

Domain documentation uses a single-context layout: skills read a root `GLOSSARY.md` glossary (named
`CONTEXT.md` until upstream v1.3.0 renamed the convention) and root `docs/adr/` decisions when
present. The configuration does not create either path eagerly; domain-modeling workflows create
them only when a real term or decision needs recording. Existing product documentation, Agent Notes,
protected-file rules, and the E2E-first testing policy remain authoritative.

This note partially supersedes only the context-and-ADR conclusion in
[the earlier Matt Pocock skills decision](../../archived/process/2026-09-26-matt-pocock-skills.md). Its decision to
keep project-local adaptations was later reversed: both were removed by
[a superseding decision](2026-10-01-remove-duplicate-upstream-skills.md), so the upstream skills configured
here are the only ones in use.

## Alternatives considered

**Keep the existing documentation conventions only.** Not chosen because the newly enabled
engineering skills would have no shared tracker, label, or domain-document configuration.

**Use a multi-context domain layout.** Not chosen because the application is one deployable product
with shared product language, despite being organized as a pnpm monorepo.

**Track issues as local Markdown.** Not chosen because the repository already uses GitHub and its
remote issue tracker is the team-visible work surface.

## Consequences

Engineering skills have one explicit place to discover repository workflow metadata. Maintainers
must keep `docs/agents/` accurate when tracker conventions or domain-document layout changes. The
root context and ADR paths add another documentation convention, but they remain lazy and do not
replace the repository's existing product docs or Agent Notes.

## Sources

- [Earlier Matt Pocock skills decision](../../archived/process/2026-09-26-matt-pocock-skills.md).
- [Repository agent instructions](../../../../AGENTS.md).
- [Engineering skills setup](../../../../docs/agents/domain.md).
