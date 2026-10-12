---
date: 2026-10-12
author: Codex
branch: docs/skill-maintenance-refresh
pr: 310
area: .agents/skills, docs
contract-impact: none
---

# Name the checkpoint exclusion set after the documented concept

## What changed

- Renamed the local `absorbedIssues` set to `reviewedIssueNumbers` in
  `.agents/skills/skill-maintenance/scripts/is-due.mjs`.

## Why

The two-axis review flagged that the script's local name disagreed with the
checkpoint field `reviewedIssues` used by `.agents/skills/skill-maintenance/SKILL.md`.
The rename makes the set's purpose read the same way as the documented field.
The other review points were judgement calls about prose repetition in the new
`e2e-maintenance` skill and its note and log; each restates the "reuse the
existing runner" boundary for its own audience, so they were left as written.

## Validation

- `node --check .agents/skills/skill-maintenance/scripts/is-due.mjs` - OK
- `node scripts/verify-docs.mjs` - Agent Notes, skills and Markdown links are valid.
- `node apps/web/tests/cli-e2e/skill-maintenance.e2e.mjs` - 61 CLI cases passed.

## Notes for the next person

None.
