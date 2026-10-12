---
date: 2026-10-11
author: Codex
branch: feature/e2e-performance-acceptance
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Close the performance review against standards and specification

## What changed

- Remove new explanatory comments from runtime and acceptance scripts, including the final inline map comment.
- Add Vercel and Currents attribution to root THIRD_PARTY_NOTICES.md with repository-relative paths.
- Keep the new performance proposal independent of an unrelated untracked CLI design record.

## Why

The original CLI specification explicitly prohibited new code comments. General review and repository-risk review missed that requirement until the user pointed it out. Review must inspect the originating specification as well as repository standards.

## Validation

- Independent reviewer confirmed the notice correction and found one remaining inline comment; it was removed.
- pnpm verify:docs passed before the final reference correction; final checks are recorded with the pull request.
- Scoped Prettier initially flagged the root notice; it was formatted.
- Earlier browser and CLI evidence remains under output/e2e/performance-review/2026-10-11/; this cleanup changes no executable statements.

## Notes for the next person

- Project code-review is the repository risk reference; the global same-name skill is the Standards/Spec review workflow. OCR review skills are separate CLI integrations.
- Retro candidate: add a task-scoped deterministic comment check when a specification prohibits comments; do not turn that constraint into a global comment ban or change protected configuration without authorization.
- R3–R5 optimizations remain candidates. Prior validation does not establish remote CI success.
- Unrelated Android, UI guidelines, historical session logs and CLI design files remain outside this delivery.
