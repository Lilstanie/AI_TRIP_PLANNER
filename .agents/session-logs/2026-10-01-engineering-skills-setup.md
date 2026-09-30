---
date: 2026-10-01
author: Codex
branch: docs/engineering-skills-setup
pr: none
area: agent workflow documentation
contract-impact: none
---

# Configure repository metadata for engineering skills

## What changed

- Added the `AGENTS.md` skill-discovery block for the issue tracker, triage labels, and domain docs.
- Added English and Chinese `docs/agents/` configuration for GitHub Issues, canonical triage labels,
  and a single-context domain-document layout.
- Recorded the three reviewed translation pairs in `.agents/translation-pairs.json`.
- Added the engineering-skills configuration Agent Note and cross-linked the earlier Matt Pocock
  skills decision that it partially supersedes.

## Why

The engineering skills need stable repository-owned metadata instead of inferring tracker and
domain conventions on every run. The new decision record makes the intentional context/ADR policy
change explicit without replacing the existing project-local skill adaptations.

## Validation

- `pnpm verify:docs` — passed; Agent Notes, skills, and Markdown links are valid.
- `pnpm verify:protected` — passed relative to `origin/main`.
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs` — passed; 15 pairs checked.
- `pnpm exec prettier --check <changed files>` — passed.
- `git diff --check` — passed.

## Notes for the next person

- The configuration does not create GitHub labels, `CONTEXT.md`, or `docs/adr/`; those remain
  tracker-managed or lazily created when needed.
