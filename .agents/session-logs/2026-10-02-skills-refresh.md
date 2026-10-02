---
date: 2026-10-02
author: Claude
branch: docs/skills-refresh
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Bring three skills and the development guide up to date with #86–#115

## What changed

- `pre-push-checks`: CI now runs `test:scripts` and the pair check, so the intro, the "full five" and the
  docs row say so; new rows for E2E scripts, `apps/web/drizzle/**` and `scripts/**` / skill files.
- `code-review`: four defect classes from the Agent Lab review fixes and the accounts work: labels and
  verdicts read from data, checks that can fail, optional Clerk/Neon, observers that never steer.
- `ui-verification`: the sign-in gate, which paths stay public, how to reach the workspace in a script,
  E2E scripts as repeatable evidence and the reduced-motion state.
- `docs/development.md` and `.zh.md`: removed "no checked-in E2E runner" and "pairs not in CI"; documented
  the API and browser E2E scripts, their options and output folders; CI runs five commands.

## Why

Skills last changed in #115 for format only. Their content predated the accounts, Agent Lab and E2E
work, and two statements (pairs not in CI, no E2E runner) had become false.

## Validation

- `pnpm verify:docs`: passed. `pnpm verify:protected`: passed. `pnpm test:scripts`: 26 of 26 passed.
- `check-pairs.mjs`: first run failed (the Chinese fence comment differed); fixed, recorded
  `docs/development.md`, then it checked 15 pairs.
- `npx prettier --check` on the three skills and both development pages: passed after formatting
  `pre-push-checks`.
- Not run: typecheck, lint, tests and build (no code changed). The E2E commands in the docs were not
  re-run; they describe scripts already merged in #114 and earlier.

## Notes for the next person

The E2E scripts are still not in CI; the docs now say so rather than imply otherwise.
