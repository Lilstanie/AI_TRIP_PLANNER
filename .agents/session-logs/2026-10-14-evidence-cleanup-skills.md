---
date: 2026-10-14
author: Claude Code
branch: docs/evidence-cleanup-skills
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Align skills with pnpm clean:output and the Android wrapper removal; re-record the checkpoint

## What changed

- `e2e-maintenance`, `ui-verification` and `pre-push-checks`: quote or attach evidence in the pull
  request before `pnpm clean:output` (#342) deletes the ignored output directories.
- `ui-verification`, `docs/workspace-ui.md` and its Chinese pair: #182 is closed as not planned
  (#343), so device-only behaviour is reported as not verified.
- `review-checkpoint.json`: reviewed revision moved to `87e26199`, with delta summaries.

## Why

#342 and #343 merged after the `8ab8a0c3` review and made the review due again (convention and note
changes). Every file changed since `8ab8a0c3` was read; no other skill names `.gitignore`,
`clean-output.mjs`, the removed Android files or the dropped `assetlinks.json` checks.

## Validation

- `pnpm verify:docs`, `pnpm verify:pairs` (26 pairs, `docs/workspace-ui.md` re-recorded after
  matching edits) and `pnpm verify:protected` passed; Prettier clean.
- `check-skills.mjs`: no missing path or broken command.
- `is-due.mjs` on the committed record: see the pull request Evidence section.

## Notes for the next person

none
