---
date: 2026-10-16
author: Claude Opus 5.5
branch: process/pairs-diff-check
pr: pending
area: .agents/skills, docs, .agents/notes
contract-impact: none
---

# The pair check compares with its base instead of stored hashes

## What changed

- `.agents/skills/translate-docs/scripts/check-pairs.mjs`: no manifest; a `--base` diff rule (default `origin/main`) fails when an English page changed beyond whitespace and its Chinese page did not. `--record` and `--remove` fail with a retirement message.
- `.agents/translation-pairs.json`: deleted.
- `apps/web/tests/cli-e2e/translation-pairs.e2e.mjs`: nine new failure modes written before the code; the structural cases now run in check mode.
- `.agents/skills/translate-docs/SKILL.md`, `.agents/skills/pre-push-checks/SKILL.md`, `docs/i18n.md` and `.zh.md`: describe the diff rule; the merge-conflict recipe is gone.
- `.agents/skills/skill-maintenance/scripts/check-skills.mjs`: drops the record from its known record files.
- New [diff-based pair check note](../notes/implemented/process/2026-10-16-diff-based-pair-check.md); the bilingual-docs note links to it.

## Why

Decided with the owner (retro item 1, option B): four of six parallel PRs conflicted on the same pair's record. A per-pair split would not have prevented that.

## Validation

- `node apps/web/tests/cli-e2e/translation-pairs.e2e.mjs` before the rewrite: failed on the first fixture (`unrecorded review`); after: 19 CLI cases passed.
- `pnpm verify:pairs`: 26 pairs checked against origin/main. `pnpm verify:docs`, `verify:protected`, `test:scripts` (35 passed): pass.
- `check-skills.mjs`: no errors; the same 7 review prompts as on `main`.

## Notes for the next person

- Touching a Chinese page satisfies the check whether or not it was reviewed; review before pushing.
