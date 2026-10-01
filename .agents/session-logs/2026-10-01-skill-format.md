---
date: 2026-10-01
author: Claude
branch: fix/skill-format
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Bring the project skills in line with the SKILL.md format

## What changed

- Moved the 11 reference files that sat beside `SKILL.md` into each skill's `references/` directory
  (`better-accessibility`, `better-layout`, `better-ui`, `break`) and rewrote every link to them,
  including `docs/design/ui-guidelines` in both languages and the third-party notice.
- References no longer link to other references or into another skill's files: those links became
  plain mentions or point at the other skill's `SKILL.md`, so the hierarchy stays one level deep.
- Rewrote 13 `description` fields as what the skill does, then when to use it, with the same keywords.
  `libraries-dev` gained `license`, since it ships a `LICENSE`.

## Why

The format guide at https://qiao1.top/posts/fcc443a7.html asks for a flat `SKILL.md` plus `scripts/`,
`references/` and `assets/`, one level of references, and a description that says what and when.

## Validation

- Every skill has a name matching its folder, a description of at most 1024 characters, a `SKILL.md`
  under 500 lines and only permitted frontmatter fields (parsed as YAML).
- `pnpm verify:docs`, `pnpm verify:protected` and the translation pair check pass.

## Notes for the next person

The archived note `2026-09-24-glass-control-layer.md` still links the old `better-ui/glass.md` path; it is
frozen, and `verify:docs` skips frozen history.
