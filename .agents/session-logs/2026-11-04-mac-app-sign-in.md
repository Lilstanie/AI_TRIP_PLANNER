---
date: 2026-11-04
author: Claude Code
branch: feature/macos-app
pr: 972
area: apps/macos, docs
contract-impact: none
---

# Keep Apple and GitHub sign-in inside the Mac app

## What changed

- `apps/macos/Resources/link-policy.json` + `LinkPolicy.swift`: the in-app link rules moved out of
  `Browser.swift` into a bundled file, adding `appleid.apple.com/auth/…`, `github.com/login…` and
  `github.com/session…`. `build-app.sh` copies the file.
- `apps/macos/tests/sign-in-links.e2e.mjs` and `sign-in-links.failures.md` (written first).
- Agent Note and `docs/development.md` / `.zh.md`.

## Why

A sign-in test against production with the app's user agent showed Apple, GitHub and Google all
leaving the app for the default browser, so the session landed in Safari. The owner chose to keep
Apple and GitHub in the app and leave Google in the browser (Google forbids embedded web views).

## Validation

- `PLAYWRIGHT=/opt/node22/lib/node_modules/playwright node apps/macos/tests/sign-in-links.e2e.mjs`:
  6/6. With `LINK_POLICY` pointing at the old rules (app hosts only): 4/6, Apple and GitHub fail
  with `external: ["appleid.apple.com/auth/authorize"]` and `["github.com/login/oauth/authorize"]`.
- The first Apple check failed on a correct page: Apple writes "Apple Account" with a no-break
  space, so the patterns use `\s`.
- No credentials were entered; Swift still not compiled here.

## Notes for the next person

- Apple and GitHub are checked only up to their sign-in page. Try a full sign-in in the built app.
