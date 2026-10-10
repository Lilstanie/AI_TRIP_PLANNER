---
date: 2026-10-10
author: Codex
branch: refactor/remove-code-comments
pr: none
area: apps/web, apps/android-twa, packages, scripts, submission, .agents/skills
contract-impact: packages/shared
---

# Remove explanatory comments from maintained code

## What changed

- Removed 5,382 explanatory comments across 440 maintained code/configuration files.
- Preserved compiler/lint/selector directives, SQL delimiters, shebangs and third-party notices.
- Added the [cleanup decision](../notes/implemented/simplification/2026-10-10-code-comment-cleanup.md) for shared-source text changes; no runtime contract changed.
- Clarified that the earlier simplification inventory ends at `d6d52e8`.

## Why

The user requested comment removal. Syntax-aware removal preserves strings, regular expressions,
templates and JSX behavior; comments that operate tools remain functional source.

## Validation

- TypeScript syntax structure checked before formatting; final normalized JavaScript emission matches in 400 changed files, and CSS structure matches in 31.
- Python builder AST unchanged; audit finds no removable comments in the eligible scope.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:scripts`, `pnpm build`: pass; 1,163 tests and 35 script checks.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm verify:e2e-selectors`: pass; 25 pairs.
- Direct changed-file Prettier check and `git diff --check`: pass after removing trailing whitespace.

## Notes for the next person

No new browser/native/live-provider runs: this change removes prose and retains the executable structure.
Frozen/protected files and generated wrappers/artifacts are excluded. Earlier baseline E2E failures remain.
Evidence and the one-off removal/verifier scripts are outside the repository in
`/Users/joey/Downloads/AI-Trip-Planner-Comment-Cleanup-2026-10-10/`. Changes are local, unpushed.
