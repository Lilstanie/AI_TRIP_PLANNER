---
date: 2026-10-07
author: Claude Code (Sonnet 5.5) for Joey
branch: feature/223-mit-license
pr: none
area: docs, root and workspace package.json
contract-impact: none
---

# License the repository under MIT and add third-party notices

## What changed

- Added `LICENSE` (MIT, 2026, "the AI Trip Planner contributors (ELEC5620 group)").
- Added `THIRD_PARTY_NOTICES.md` with the DeepSeek Harness entry; #220 fills in the files.
- Set `"license": "MIT"` in the root and all six workspace `package.json` files.
- Rewrote the License section of `README.md` and `README.zh.md`.
- Added a licence and third-party code section to `docs/development.md` and `.zh.md`.

## Why

Joey asked for MIT (issue #223) and approved changing the protected root `package.json` ("都可以改").
The group should still agree before merge, since each contributor holds copyright in their commits.

## Validation

`pnpm install --frozen-lockfile`, `verify:docs`, `verify:pairs` and `verify:protected` were run in the
implementing session; the results are in its report.

## Notes for the next person

None.
