# Agent Note: Guardrails for several people and several AI tools

Status: implemented
Owner: A (@Lilstanie), repository owner (@HeadmasterEggy)

## Problem

Five people each work with different AI tools (Claude Code, Codex and others). Rules lived in
`AGENTS.md` and `docs/team-workflow.md` but nothing enforced them: Claude Code does not read
`AGENTS.md` by default, the ownership table had no effect on reviews, historical documents could be
rewritten by any session, and decisions were written to the Git-ignored `.ai/DECISIONS.md`, where
teammates could not see them.

## Decision

- `AGENTS.md` is the only instruction file; `CLAUDE.md` is a symlink to it. Shared agent material
  lives in `.agents/`: `notes/` for decisions, `skills/` for workflows (symlinked from
  `.claude/skills`), and the ignored `local/` for personal context that replaces `.ai/`.
- Session logs live in `.agents/session-logs/`: they record AI sessions and are not current
  documentation, so they sit outside `docs/`.
- `AGENTS.md` lists protected files: frozen history, shared contracts, team rules and root
  configuration, generated files, and files never committed.
- `scripts/verify-protected-files.mjs` runs as the `protected-files` CI job. It fails a pull request
  that modifies, renames or deletes a frozen file, or that changes `packages/shared/src` without
  adding or updating an Agent Note.
- Authors merge their own pull requests. `.github/CODEOWNERS` maps each module to its owner so
  GitHub requests their review, but no approval is required.

## Alternatives considered

**Rules in prose only.** Already tried; AI sessions rewrote archived plans and wrote decisions to an
ignored file. A check that fails CI is followed regardless of which tool reads which file.

**A separate instruction file per tool.** Copies drift apart. One file plus symlinks keeps every tool
on the same text.

**Keep decisions in `docs/`.** Possible, but `docs/` is user and developer documentation; putting
decision records beside skills in `.agents/` matches the layout of DeepSeek Harness, which this
project uses as its reference for multi-agent repositories.

**Require code-owner approval through branch protection.** Rejected: authors must be able to merge
their own pull requests, and an AI session acting under the author's account cannot count as a
second reviewer. Checks that need no other person enforce the rules that matter most.

**Freeze implemented notes as well.** Rejected: an implemented note has to follow file moves and renames, or
it becomes wrong. Only its decision is fixed; reversing it takes a new note.

## Consequences

- Fixing a typo in an archived document or an old session log is no longer possible without a
  repository admin bypassing the check.
- Team-rule and configuration files have no mechanical guard; `AGENTS.md` tells AI tools to leave
  them alone unless asked, and CODEOWNERS only requests review.
- CI failures do not block merging on their own; authors must not merge a red pull request.
- Each owner needs write access to the repository before CODEOWNERS can request their review.
- Symlinks need Developer Mode or `core.symlinks=true` on Windows clones.
