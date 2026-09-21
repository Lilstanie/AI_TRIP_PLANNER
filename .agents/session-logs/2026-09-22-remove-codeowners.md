---
date: 2026-09-22
author: Claude Code, with @HeadmasterEggy
branch: chore/remove-codeowners
pr: none
area: .github, AGENTS.md, docs/team-workflow.md, .agents/notes
contract-impact: none
---

# Stop requesting reviews automatically

## What changed

- `.github/CODEOWNERS` deleted; GitHub no longer requests reviews on any pull request.
- `AGENTS.md` and `docs/team-workflow.md` no longer mention review requests; authors merge once CI
  passes and ask a teammate themselves when they want a review.
- New note `implemented/process/2026-09-22-no-review-requests.md`; the guardrails and skills notes
  are updated and cross-linked as a partial supersession.

## Why

The repository owner does not want anyone asked to review. The A–E account mapping stays unconfirmed
and is informational only.

## Validation

- `git grep -i codeowners` finds no reference outside frozen history and the new note.
- `node scripts/verify-docs.mjs`, `node scripts/verify-protected-files.mjs origin/main`: pass.

## Notes for the next person

none
