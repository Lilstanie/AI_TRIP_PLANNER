---
date: 2026-10-15
author: Claude Code
branch: fix/pair-anchor-and-checkpoint-checks
pr: none
area: .agents/skills, apps/web/tests/cli-e2e, docs
contract-impact: none
---

# Check translated heading anchors by position and guard the checkpoint layout

## What changed

- `translate-docs/scripts/check-pairs.mjs`: each Chinese heading must carry its English counterpart's
  fragment, as an explicit anchor directly above it or through identical heading text.
- New `apps/web/tests/cli-e2e/translation-pairs.e2e.mjs` (10 cases), registered in `select.mjs` and
  the selection and CI-integration inventories; shard expectations updated.
- `skill-maintenance.e2e.mjs`: a recorded checkpoint passes `checkSkills`; the old top-level path is
  the failing control.
- H1 anchors added to `e2e-known-failures.zh.md` and `local-test-cli.zh.md`; `i18n` pair and
  translate-docs skill describe the rule.

## Why

Retro of the 2026-10-14 sessions: seven Chinese pages had misplaced anchors that existence-only
checks accepted, and the documented checkpoint path failed `verify-docs` without any test noticing.

## Validation

- `translation-pairs.e2e.mjs`: 10 passed; removing the new check makes "misplaced anchor" fail.
- `skill-maintenance.e2e.mjs`: 62 passed. `selection`, `runner-plan` and `ci-integration`
  acceptance passed.
- `pnpm verify:docs`, `verify:pairs`, `verify:protected`, web lint and the added-comment check passed.

## Notes for the next person

none
