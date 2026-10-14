---
date: 2026-10-14
author: Claude Code
branch: docs/full-skill-review
pr: none
area: .agents/skills
contract-impact: none
---

# Complete a full review of all 22 project skills and record the checkpoint

## What changed

- `better-accessibility`: the focus ring is `box-shadow: var(--ring)` beside a transparent 2px
  outline, as `base.css` draws it, not `outline: none`.
- `end-to-end-feature-wiring` and `review-trip-planner`: signed-in account sync is a separate
  server-revision owner after #334; the browser plan guard is not the only revision mechanism.
- `review-trip-planner/references/handoff.md`: the comment check is the repository default (#312),
  not a per-task option.
- `skill-maintenance/review-checkpoint.json`: first completed full review at `8ab8a0c3`.

## Why

Every SKILL.md was read against the code at `8ab8a0c3`, whose tree `e5721f4e` equals the reviewed
#340 head `bc4f57e8`. Named paths, tokens, commands, scripts, error classes, thresholds and issue
states were checked; vendored reference sets were checked through their project-scope entrypoints
and upstream pins. Per-skill outcomes are the checkpoint summaries. Open Issues #338, #182 and #173
need no skill change.

## Validation

- `pnpm verify:docs`, `pnpm verify:pairs` and `pnpm verify:protected` passed.
- `check-skills.mjs`: no missing path or broken command.
- `is-due.mjs` after committing: see the pull request Evidence section.

## Notes for the next person

- `.agents/notes/README.md` says rejected notes may be deleted; AGENTS.md and verify-protected
  forbid it. The README is protected and was not changed.
- `PlacePreview` draws the photo hairline with `border-bottom`, not the contract's inner outline.
- The review handoff depends on the global `code-review-standards-spec` skill, which is not in the
  repository.
