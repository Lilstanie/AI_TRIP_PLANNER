---
date: 2026-09-27
author: Codex
branch: feature/account-settings-language
pr: none
area: apps/web, docs
contract-impact: none
---

# Combine account and settings navigation, with language in settings

## What changed

- Replaced separate sidebar Language, Settings and account controls with one profile-style Settings & account menu.
- Added Account settings and Personalization destinations; kept Language & region in the shared settings dialog.
- Updated English and Chinese workspace UI docs and the translation-pair record.

## Why

The footer now follows Mindtrip's profile-menu pattern, while preserving the existing settings sections and keeping language easy to find.

## Validation

- `pnpm typecheck` — passed (6 packages).
- `pnpm lint` — passed (no ESLint warnings or errors; Next.js emitted existing root/deprecation notices).
- `pnpm verify:docs` — passed.
- `pnpm verify:protected` — passed.
- `git diff --check` — passed.
- Browser review — ArrowUp/ArrowDown opened and moved through the menu; Escape closed it and restored trigger focus; Enter opened Account settings; Language & region opened from the settings tabs. Desktop and 390px narrow layout reviewed.
- Translation-pair check — workspace UI pair reviewed and recorded; overall check reports the pre-existing untracked `docs/problem.md` has no Chinese pair and is unrecorded.

## Notes for the next person

- `docs/problem.md` was present before this change and remains untouched; resolve its translation separately if it should be tracked.
