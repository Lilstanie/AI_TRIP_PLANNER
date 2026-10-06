---
date: 2026-10-05
author: Claude Code
branch: docs/skills-review-2026-10-05
pr: none
area: .agents/skills
contract-impact: none
---

# Teach the skills the bilingual interface and display currency

## What changed

- `better-writing`: money goes through `money()` with currency codes instead of a hand-written
  `A$`; every interface string and `aria-label` goes through `t()` with a Chinese entry, using
  `|context` keys and placeholders.
- `code-review`: two checks, display is not storage (AUD stays the planning and storage currency,
  `budgetSource` beside it) and interface strings reach `t()`.
- `ui-verification`: look at the change again in 中文 and, for money, in a non-AUD currency.

## Why

The daily due check reported a review: 8 merged PRs, 11 closed issues and 5 Agent Note commits since
#157. #160 and #163–#166 added the EN/中文 interface, reply language and display currency, which made
the `A$1,234` rule in better-writing wrong and left the other skills silent on `t()`.
Other drift flags (agent-experience, better-accessibility, better-layout, stage1-submission,
translate-docs) were read and need no change.

## Validation

- `is-due.mjs`: due, exit 10; `check-skills.mjs`: no errors before or after.
- `verify:docs`, `verify:pairs`, `verify:protected`, Prettier: see the PR's Testing section.
