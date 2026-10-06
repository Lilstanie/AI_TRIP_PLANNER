---
date: 2026-10-06
author: Claude Code
branch: fix/dev-port-and-e2e-ci
pr: none
area: apps/web, .github, docs, .agents/skills
contract-impact: none
---

# Dev port, E2E in CI and the merged-pair hint (retro of PR #192)

## What changed

- `apps/web/package.json`: `dev` and `start` no longer pass `-p 3000`, so Next reads `PORT`
  (default 3000). Parallel worktrees in the PR #192 session each hit the hard-coded port.
- `.github/workflows/ci.yml` (Joey approved the retro's changes in the project thread): a new `e2e`
  job builds the web app, starts it, and runs the twelve browser scripts that pass without provider
  keys, uploading `output/playwright/` and the server log.
- `docs/development.md` / `.zh.md` describe the job and `PORT`; `pre-push-checks` says when CI runs E2E
  and that a merge of two re-recorded pairs needs `check-pairs.mjs --record` again.

## Validation

- Production build of `main` (no `.env*`), `PORT=3200 pnpm start` served on 3200, then each browser
  script with `BASE_URL=http://localhost:3200`. Passing (kept in CI): display-currency 50,
  source-budget 22, timeline 24, workspace-chinese 27, reply-language 6, installable-app 23,
  agent-lab-benchmarks 80, -comparison 155, -live-gate 33, -release 171, -revision 77,
  -single-agent 72 (ok counts, 0 FAIL, exit 0).
- `pnpm verify:docs`, translation pairs and prettier on changed files: pass.

## Notes for the next person

- Failing on `main` without keys, left out of CI for now: itinerary, liquid-glass, thinking-orb (place
  lookups answer 502 without a Maps key and the scripts count that as a console error); settings and
  ui-language (currency assertions behind the display-currency work); agent-lab-failures (1 FAIL) and
  agent-lab-replay (times out waiting for a file chooser).
- Once PR #183 lands, add `phone-shell`, `phone-mine`, `phone-map` and `phone-state` to the list.
