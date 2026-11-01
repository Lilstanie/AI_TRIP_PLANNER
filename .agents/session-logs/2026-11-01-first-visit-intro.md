---
date: 2026-11-01
author: Claude Code (for Joey)
branch: feature/TP-224-first-visit-intro
pr: pending
area: apps/web
contract-impact: none
---

# First-visit intro page in front of the workspace (TP-224)

## What changed

- `apps/web/components/intro/IntroGate.tsx` and `FirstVisitIntro.tsx`: full-screen intro on a browser's
  first visit; Start planning stores `trip.intro.seen.v1`; `/?intro` shows it again.
- `apps/web/app/page.tsx` wraps `Workspace` in `IntroGate`; styles in `app/styles/intro.css`.
- Copy in `lib/i18n/messages/en-shell.ts` and `zh-shell.ts`; `docs/workspace-ui(.zh).md` section.

## Why

The gate lives in `page.tsx`, not `Workspace`, so component tests that render `Workspace` are
untouched. Automated browsers (`navigator.webdriver`) skip it so the existing E2E scripts still land
on the workspace.

## Validation

- `tsc --noEmit`, `eslint`, `prettier --check`, `check-ui-copy.mjs`: pass.
- Playwright against `next dev`: intro on desktop zh, desktop en dark, phone zh with no horizontal
  scroll; Start planning opens the workspace and a reload skips the intro; a webdriver browser
  opening `/` gets the workspace.

## Notes for the next person

none
