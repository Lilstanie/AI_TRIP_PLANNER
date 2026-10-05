---
date: 2026-10-05
author: Claude Code
branch: feature/installable-app
pr: none
area: apps/web, apps/android-twa, docs
contract-impact: none
---

# Make the workspace installable on computers, iPhone and Android (TWA)

## What changed

- `apps/web`: web app manifest, icons generated from the brand logo, offline service worker and
  page, Apple and theme-colour metadata, and a public `/.well-known/assetlinks.json`.
- `apps/android-twa/`: Bubblewrap 1.25 TWA project for `elec5620-ai-trip-planner.vercel.app`.
- `apps/web/tests/e2e/installable-app.e2e.mjs`, the development docs in both languages and an
  implemented Agent Note.

## Why

Design agreed with Joey in the project thread; the reasons are in the
[Agent Note](../notes/implemented/feature/2026-10-05-installable-app.md).

## Validation

- `pnpm --filter @trip/web typecheck`: passed. `pnpm --filter @trip/web build`: passed.
- `pnpm --filter @trip/web lint`: passed. `pnpm --filter @trip/web test`: 454 tests passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`: passed.
- Installable-app E2E against `next start`: 23/23 checks passed at desktop and phone widths,
  including no Chrome installability errors and the offline page with its cached icon.

## Notes for the next person

- The project was generated against locally served icons because the deployment had none yet;
  `bubblewrap build` regenerates it from the live site if `twa-manifest.json` changes.
- The APK has not been built or signed yet: that needs the keystore on module C's machine.
  `assetlinks.json` is `[]` until then.
- Playwright's offline switch does not reach service worker fetches; the E2E aborts routed
  requests instead.
