---
date: 2026-10-04
author: Claude Code
branch: docs/skills-after-stage1
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Bring the skills up to date with PRs #119–#152

## What changed

- New `.agents/skills/stage1-submission/SKILL.md`: which copy of the Stage 1 model owns each piece
  (docs/design/stage1 pages, report parts, `build_deck.py`, video script), regenerate rather than
  hand-edit the deck, one image copy, complete diagrams, one member per PR.
- `add-provider`: adapter selection now lives in the ToolGateway port modules; raw adapters stay out
  of the package entry point; new providers add rows to the provider matrix.
- `code-review`: the mock/live rule follows the deep provider selection note; tightened shared
  contracts must still parse old data; one feature per PR; fork PR CI must actually have run.
- New `.agents/skills/skill-maintenance/` with `scripts/check-skills.mjs`: reports backticked paths and
  `pnpm` commands that no longer exist (exit 1) and commits on files a skill names since it last
  changed (prompts). Its SKILL.md adds the pull-request review step the script cannot do.
- `pre-push-checks`: a row for `submission/stage1/**` and `docs/design/stage1/**`; the tools row names
  the matrix and boundary tests. `docs/development.md` and its pair list the new skill.

## Why

Joey asked whether the PR history called for skill updates. #132/#133/#141/#143 superseded the
`mockEnabled()` instruction in add-provider; #144 was closed for reasons code-review did not cover;
#134/#140/#142/#152 repeated the same Stage 1 sync work with no skill. Joey then asked for a tool that
keeps skills updated automatically; the script finds drift, and a weekly routine runs the skill.

## Validation

- `check-skills.mjs`: 3 of 19 skills flagged for review, no errors; an injected missing path, wrong
  prefix, unknown root script and unknown package each reported, exit 1; reverted, exit 0.
- `verify:docs`, `verify:pairs`, `verify:protected`, Prettier: see the PR's Testing section.
