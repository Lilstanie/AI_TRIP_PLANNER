---
date: 2026-10-06
author: Codex
branch: docs/skills-review-2026-10-05
pr: 167
area: .agents/skills
contract-impact: none
---

# Align skill guidance with bilingual and phone workspace verification

## What changed

- `better-layout`: remove the English-only claim and distinguish narrow navigation from the
  phone shell's four tabs, linking PR #183 while it remains unmerged.
- `ui-verification`: describe language and data-mode entry points by layout; cover breakpoint
  transitions, Back, focus, keyboard and repeated-place day filtering.
- Distinguish production browser walks from real-device and live-map evidence.
- Keep the currency and typed translation rules already proposed by PR #167.

## Validation

- `pnpm verify:docs`, `pnpm verify:pairs` (24 pairs), `pnpm verify:protected`: passed.
- `pnpm test:scripts`: 26/26 passed.
- Skill drift report: no missing paths or broken commands; unrelated drift prompts remain.
- Scoped Prettier and `git diff --check`: passed.

## Notes for the next person

- Phone-specific guidance applies to branches containing PR #183; no application code changed.
- Real iPhone/Android acceptance remains tracked in #182. Review defects remain in #184 and #185.
- No new Agent Note or ordinary docs page is needed: these edits align workflows with existing
  bilingual currency decisions and the phone-shell proposal, without changing their behavior.
