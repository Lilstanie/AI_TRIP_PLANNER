---
date: 2026-10-14
author: Claude
branch: docs/delivery-workflow
pr: none
area: AGENTS.md, .github, .agents/notes
contract-impact: none
---

# Put the delivery workflow rules where every AI session reads them

## What changed

- `AGENTS.md`: new `## Delivery workflow` section with four rules.
- `.github/pull_request_template.md`: Summary, Evidence and Merge Danger sections.
- `.agents/notes/implemented/process/2026-10-14-delivery-workflow-rules.md`: the decision and its alternatives.

## Why

The workflow lived only in personal skills, so a new AI session skipped it. `AGENTS.md` and the template
are the two places any tool or person reaches. `AGENTS.md` and `.github/**` are protected; the owner
approved both changes in chat.

## Validation

See the pull request description.

## Notes for the next person

No hook enforces this; the note records when to add one. `gh pr create --body` skips the template.
