---
date: 2026-10-11
author: Codex
branch: main
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Install project-local React and Playwright reference skills

## What changed

- Added pinned, adapted `vercel-react-best-practices` and `playwright-best-practices`, with 130 reference files.
- Linked the browser reference from `ui-verification` and documented provenance and licensing.
- Updated both development documentation languages and their review hashes.
- Added the [integration decision](../notes/implemented/process/2026-10-11-framework-reference-skills.md).

## Why

The user selected project scope and retaining the project workflow while using upstream technical
references. A browser runner migration remains a separate evaluation.

## Validation

- `npx skills list -a codex --json`: both new skills discovered with project scope for Codex and Claude Code.
- `pnpm verify:docs`: passed, including skill format and Markdown links.
- New-skill drift report: passed; no missing paths or broken commands.
- `pnpm verify:protected`: passed against `origin/main`; this check covers committed changes only.
- Prettier formatting of installation files: passed; Currents licence matches upstream byte-for-byte.
- `git diff --check`: passed.
- `pnpm format:check-changed origin/main`: no committed changed files; scoped formatting is checked separately.
- `pnpm verify:pairs`: failed only for the pre-existing stale `docs/design/ui-guidelines.md` review record.
  The changed development pair was reviewed and recorded successfully.

## Notes for the next person

No runtime dependencies or test runner were changed. Existing Android, design-doc, proposed-note,
session-log and scratch changes were preserved. No application tests were needed for reference files.
