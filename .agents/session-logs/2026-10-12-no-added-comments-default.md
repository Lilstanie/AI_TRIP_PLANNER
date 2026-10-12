---
date: 2026-10-12
author: Codex
branch: docs/no-added-comments-default
pr: none
area: docs, .agents
contract-impact: none
---

# Make "no added comments" the repository default

## What changed

- `AGENTS.md`: a Working rule that maintained source carries no explanatory comments, naming what a
  comment may still carry.
- `.agents/notes/implemented/process/2026-10-12-no-added-comments-default.md`: records the reversal.
- `.agents/notes/archived/simplification/2026-10-10-code-comment-cleanup.md`: the earlier cleanup
  note, archived with an `Archived:` line and its sibling link repaired.
- `prose-standard`, `review-trip-planner` and its `references/comment-policy.md`: aligned the comment
  guidance and made the added-comment check the default rather than task-triggered.
- `docs/development.md` and `.zh.md`: dropped the stale "task-scoped" description of the gate.

## Why

The archived note recorded its cleanup as one-time, so nothing later was bound by it, and the gate
ran only when a task happened to prohibit comments. `AGENTS.md` is the only file every implementation
run reads, so the default belongs there. Reversing the earlier decision required a new note plus
archiving the old one.

## Validation

- `node scripts/verify-docs.mjs` - Agent Notes, skills and Markdown links are valid.
- `node scripts/verify-protected-files.mjs origin/main` - Protected-file rules hold.
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs` - Checked 26 documentation pairs.
- `npx prettier@3.4.2 --check` on each changed file - All matched files use Prettier code style.

## Notes for the next person

The check is still a local review gate, so a review that skips it lets comments through. A comment
that carries a contract or a tool instruction stays legitimate; the rule targets narration.
