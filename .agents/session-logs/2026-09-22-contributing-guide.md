---
date: 2026-09-22
author: Claude Code, with @HeadmasterEggy
branch: docs/contributing-guide
pr: none
area: CONTRIBUTING.md, README, docs, scripts
contract-impact: none
---

# A contributor guide for writing and shipping code

## What changed

- `CONTRIBUTING.md` (Chinese): setup, branches and merging, where code goes, coding rules, shared
  contracts, checks, documentation, protected files, AI tools and pull requests. It links to the
  owning document for each rule instead of restating it.
- `README.md` and `docs/AGENTS.md` list it; `scripts/verify-docs.mjs` checks its links.
- `docs/team-workflow.md` lists `chore/` among branch prefixes, as already used.

## Why

`AGENTS.md` is written for AI tools; people working with them had no single entry point.

## Validation

- Every rule traced to its source: `AGENTS.md`, `development.md`, `team-workflow.md`, the skills,
  the notes and the CI jobs.
- `node scripts/verify-docs.mjs`, `node scripts/verify-protected-files.mjs origin/main`: pass.

## Notes for the next person

- When a rule changes in its home document, update the matching line here in the same PR.
