---
date: 2026-10-22
author: Claude (project thread, for Joey)
branch: docs/ui-copy-and-root-cause
pr: none
area: docs
contract-impact: none
---

# Add UI copy and root-cause rules from the X post discussion

## What changed

- `.agents/skills/better-ui/SKILL.md`: new "Copy and labels" section. Remove secondary labels and
  helper copy that repeat the layout; keep form labels and accessible names.
- `docs/design/ui-guidelines.md`: Do's and Don'ts item 6 with the same rule.
- `docs/development.md`: "Fix root causes" under Agent workflows. Reproduce, name the cause, fix it;
  no retries, longer timeouts or guards that only hide the symptom.

## Why

Joey asked for the first-principles ideas in an X thread to be applied to this repo. The thread's
concrete tip is to drop redundant explanatory copy. The root-cause rule came from the same post's
author. Both are written as rules in docs and skills, not in AGENTS.md, which is a protected team
rules file that needs an explicit request.

## Validation

- `pnpm verify:docs`: "Agent Notes, skills and Markdown links are valid." (exit 0)
- `pnpm verify:protected`: "Protected-file rules hold relative to origin/main." (exit 0)
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs`: "Checked 28 documentation pairs against origin/main." (exit 0)
- The first push failed the protected-files CI job on the pair check. `ui-guidelines.zh.md` and
  `development.zh.md` lacked the counterparts of the edits; added them and reran the check.

## Notes for the next person

- Not done: a lint or review check for helper copy (idea 3 from the discussion). It needs a new
  script under `scripts/verify-*.mjs`, which is protected.
- Not done: an AGENTS.md line for the root-cause rule. Needs an explicit request.
- Spec #561 (five expert assistants) was not read in this change.
