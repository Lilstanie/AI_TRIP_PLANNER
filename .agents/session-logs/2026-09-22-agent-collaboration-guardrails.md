---
date: 2026-09-22
author: Claude Code, with @HeadmasterEggy
branch: chore/agent-collaboration-guardrails
pr: none
area: repo tooling, docs, .agents, .github
contract-impact: none
---

# Enforce protected files and share one agent setup across AI tools

Decision and rationale: [Agent Note](../notes/accepted/2026-09-22-agent-collaboration-guardrails.md).

## What changed

- `CLAUDE.md` → `AGENTS.md` symlink; `.agents/` with `notes/`, `skills/` (linked from `.claude/skills`)
  and ignored `local/`, replacing `.ai/`.
- `AGENTS.md` gains a Protected files section; `scripts/verify-protected-files.mjs` and the
  `protected-files` CI job reject edits to frozen files and shared-contract changes without an Agent Note.
- `.github/CODEOWNERS` and a PR template; GitHub handles added to `docs/team-workflow.md`.
- Session logs moved from `docs/session-logs/` to `.agents/session-logs/`, content unchanged; the
  check allows unchanged moves between frozen paths and rejects new files in the old directory.
  `.prettierignore` excludes frozen files so `pnpm format` cannot rewrite them.
- `.gitignore` no longer ignores new `.env.example` files.

## Why

Modeled on deepseek-ai/deepseek-harness: one instruction file for every tool, decisions kept outside
session logs, and rules enforced by checks instead of prose.

## Validation

- `node scripts/verify-protected-files.mjs origin/main`: passes on this branch (exit 0).
- Throwaway commit changing `packages/shared/src` without an Agent Note: fails (exit 1).
- Throwaway commit editing an archive file and a moved log, and adding a log under the old
  directory: fails (exit 1) and lists all three.
- `npx prettier --check` on the changed Markdown and script: clean after `--write`.

## Notes for the next person

- The A–E to GitHub mapping was inferred from PR history; confirm it.
- `@jbia0391` needs write access before CODEOWNERS can request their review.
- No branch protection: authors merge their own PRs; reviews are requested, not required.
