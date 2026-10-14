---
date: 2026-10-14
author: Claude Code
branch: docs/sync-upstream-skills
pr: none
area: .agents/skills
contract-impact: none
---

# Sync the jakubkrehel interface skills and Libraries.dev with upstream

## What changed

- Three-way merged the copied references of `better-accessibility`, `better-layout` and
  `better-ui/references/performance.md` from jakubkrehel/skills `267330e1` to `4c66b1fa`; `break`
  kept its project scenarios.
- Ported upstream rules into the project entrypoints: WCAG 2.5.7, 2.4.11 and 2.2.2 plus
  criterion-backed severity in `better-accessibility`; undo, status copy, toggles and link text in
  `better-writing` with a new `references/patterns.md`; "content bleeds, controls float" in
  `better-layout`.
- Updated four `libraries-dev` references from Libraries.dev `f2011632` to `a2756655`.
- Updated pins in `THIRD_PARTY_NOTICES.md`, `libraries-dev/SKILL.md` and both implemented notes.

## Why

Project lines win where the code depends on them: the global reduced-motion switch in `base.css`,
the 1000/520 px workspace breakpoints and the `tabular-nums` rule. `better-ui` keeps its token values
(press scale `0.97`, `--border` photo outline) over upstream's new exact values. Upstream mentions
of the unadapted `better-typography` and `better-colors` were replaced. `patterns.md` omits ICU
plurals and `Intl` formatting because `t()` and `money()` own them, and its quoted strings marked
_existing_ were checked against `apps/web/lib/i18n/`.

## Validation

- `pnpm verify:docs`: passed after reference-to-reference links became backticked names.
- `pnpm verify:pairs`: 26 pairs checked. `pnpm verify:protected`: rules hold.
- `prettier --check` on every changed file: passed.
- `check-skills.mjs`: no missing path in the changed skills; `e2e-maintenance` already reports
  `output/e2e/ci-integration-` on `origin/main`.
- The four Libraries.dev references equal Prettier-formatted upstream; the other three are unchanged.

## Notes for the next person

- Upstream added `better-typography`, `better-colors`, `better-interface`, `state-machine`,
  `variant` and `technical-drawing`; none is adapted here.
- deepseek-harness skills were not compared in this change.
