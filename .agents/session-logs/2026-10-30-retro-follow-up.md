---
date: 2026-10-30
author: Claude Code
branch: docs/TP-168-retro-follow-up
pr: none
area: scripts, .agents/skills, docs
contract-impact: none
---

# Act on the 2026-10-30 retro: feedback rounds, real-model evidence, screenshots, file length

## What changed

- `ui-verification`: "Real-model runs" (fixture runner blanks model keys; `liveDataAllowed()` off
  means no model; check `/api/data-mode` `liveBlock: null` and the log), a final-screenshot step and
  §6 "Feedback rounds" (list every user message per reply; "done" only after the preview is rebuilt).
- `.agents/skills/ui-verification/scripts/snap.mjs` with `snap.failures.md` (written first):
  desktop, phone and optional dark shots of one URL or selector.
- `scripts/check-file-length.mjs` with its failure inventory (written first) and test: changed
  source files over 1000 lines fail. Listed in `pre-push-checks`, `trip-planner-pr-delivery` §3 and
  `docs/development(.zh).md`.
- `trip-planner-pr-delivery` §3: new-area feedback on a green PR goes to a stacked PR; ask the user
  past about 60 files or 3,000 lines.

## Why

The 2026-10-30 retro (`/mnt/project-files/retro/2026-10-30-ui-and-cleanup-retro.md`, Joey: 全部):
six dropped UI requests in PR #782, a fixture run reported as a real-model run, a 217-file PR, and
verification that predated the last change. The file-length rule is mechanical, so it is a script.

## Validation

- `node --test scripts/check-file-length.test.mjs`: 4/4 pass.
- `snap.mjs` against a local static page: selector shot plus dark exit 0; missing selector, 404,
  unreachable port and a 900 px wide phone page each exit 1 with the reason; no URL and an unknown
  flag exit 2. Against `pnpm --filter @trip/web dev` on port 3123 (mock data, no Clerk): four shots,
  exit 0.
- `pnpm test:scripts`, `verify:docs`, `verify:pairs`, `verify:protected`,
  `format:check-changed origin/main`, `check-ui-copy`, `node scripts/check-file-length.mjs`: all ok.

## Notes for the next person

- The file-length check is not in CI; adding it needs a `.github/**` change. Three files on main are
  already over 1000 lines; the split thread owns them, and the check only fails when a PR touches one.
- Project-memory changes from the same retro (merge rule, /loop via `send_later`, no Bash around a
  blocking hook) live in Claude's project memory, not the repository.
