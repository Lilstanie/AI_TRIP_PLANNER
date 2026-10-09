---
date: 2026-10-09
author: Claude Code (spec #264 run)
branch: chore/e2e-guardrails
pr: TBD
area: scripts, CI, apps/web E2E runner, docs, .agents/skills
contract-impact: none
---

# Catch stale E2E scripts and unformatted pushes earlier (#264)

## What changed

- #265 `scripts/verify-e2e-selectors.mjs` (`pnpm verify:e2e-selectors`, CI `check` job): fails when an E2E script
  selects a class no `apps/web` script source renders. Stylesheets do not count. Tests in
  `scripts/verify-e2e-selectors.test.mjs`.
- #266 `apps/web/tests/e2e/run.mjs`: per-script `E2E_SCRIPT_TIMEOUT_MS` (default ten minutes); a script past it
  is stopped with its browsers, reported as `TIME`, and the run continues.
- #267 `.githooks/pre-push` and `scripts/install-git-hooks.mjs` (root `postinstall`): `git push` runs the
  changed-files format check.
- #268 `docs/e2e-known-failures.md` and its pair; two code-review rules; pre-push-checks points at the list.
- Protected files (`.github/workflows/ci.yml`, root `package.json`, new `scripts/verify-e2e-selectors.mjs`)
  changed with Joey's approval in the project thread (2026-10-09, "都做").

## Validation

- `pnpm test:scripts` (35 pass); `pnpm verify:e2e-selectors` passes on `main` and on PR #258, and fails on the
  pre-#258-fix `display-currency` script.
- Runner: a probe that launched Chromium and never finished was reported `TIME`, the next probe ran, exit 1, no
  browser or server left.
- Hook: against a local bare remote, an unformatted push was refused, `--no-verify` passed, a formatted push passed.
- `liquid-glass` and `thinking-orb` fail on `main`; `installable-app --prod` passes.
- `verify:docs`, pairs (25), `verify:protected origin/main`, format check on changed files.

## Known limitations

- The selector check reads class selectors only, not roles, text or `data-*` attributes.
- The hook checks `HEAD` against `origin/main`, not each pushed ref.
