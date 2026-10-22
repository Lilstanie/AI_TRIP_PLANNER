---
date: 2026-10-22
author: Claude Code
branch: docs/skill-full-review-2026-10-22
pr: 595
area: .agents/skills
contract-impact: none
---

# Complete the second full review of all 22 project skills

## What changed

- `pre-push-checks`: the evidence loop calls the root `verify:e2e-selectors` and
  `verify:e2e-artifacts`, because `pnpm --filter <package> <script>` exits 0 when the script is
  missing; a new route needs an `EXPECTED` entry in `scripts/verify-api-auth.mjs` (#455).
- `better-accessibility`: the sticky-chrome rule names the one chrome that exists today.
- `better-writing`, `docs/i18n.md` and its Chinese pair: assistants (助手), Coordinator and mention.
- `libraries-dev`: `06-metal-fx.md` synced to upstream; pin `b0e5a8f1`.
- `AGENTS.md` delivery step 4: merge the pull request you opened once CI passes on the head, matching
  `docs/team-workflow.md`; the owner asked for this change.
- New checkpoint at `10a6a8f5` in `skill-maintenance/assets/review-checkpoint.json`.

## Why

Every SKILL.md was read against the code at `10a6a8f5`. Merged work since `87e2619` includes the
five-assistant spec (#561), glass calibration (#592), red/green E2E (#581) and the PR preflight
(#550). Six closed-unmerged PRs were read: #500 was redone as #550, #505 duplicated #512, #424 became
#425, #322 was superseded, #442 and #455 were closed at the owner's request. Only #455 taught a rule.

## Validation

- `pnpm verify:docs`, `pnpm verify:pairs` (28 pairs) and `pnpm verify:protected` passed.
- `check-skills.mjs`: no missing path or broken command; nine skills list advisory drift only.
- Prettier 3.4.2 on the changed files.

## Notes for the next person

- `PlacePreview` draws the photo hairline with `border-bottom`, not the contract's inner outline.
- The review handoff depends on the global `code-review-standards-spec` skill.
- PR #586 edits `better-ui` and the AGENTS.md working rules; expect a small conflict.
