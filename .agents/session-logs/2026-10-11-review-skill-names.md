---
date: 2026-10-11
author: Codex
branch: docs/review-skill-names
pr: none
area: .agents, docs, global skills
contract-impact: none
---

# Distinguish review skill names by scope

## What changed

- Rename project code-review to review-trip-planner and update current consumers, notes and bilingual development navigation.
- Rename user-global code-review to review-standards-spec and set its display name to Review Standards & Spec.
- Update actual ask-matt, implement, implement-spec and tdd consumers in both global skill directories where present.
- Record the naming decision without changing review checks, frozen history or OCR plugin cache.

## Validation

- pnpm verify:docs passed; targeted skill drift reported no missing paths or broken commands.
- Scoped Prettier and staged git diff --check passed.
- Independent staged-tree export passed documentation links and all 26 translation pairs.
- Direct consumer checks found no old invocation in either global workflow tree.
- Independent review found one upstream naming attribution mistake; it was corrected to review skill.
- No runtime code changed and no tests were run.

## Notes for the next person

- Global changes are applied locally outside Git; the repository PR carries project changes only.
- Existing unrelated Android/UI-guidelines and scratch/design files remain untouched.
- Upstream global reinstalls can restore old names; clients may need a skill-catalog refresh.
