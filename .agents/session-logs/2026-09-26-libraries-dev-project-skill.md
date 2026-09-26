---
date: 2026-09-26
author: Codex
branch: main
pr: none
area: project skills and development documentation
contract-impact: none
---

# Install the project Libraries.dev skill and group skill navigation

## What changed

- Added `.agents/skills/libraries-dev/` from upstream commit
  `f20116327f4e3b28d0fb70b04437dfd092bf88fe`, preserving seven references and the MIT licence.
- Adapted its entrypoint to the UI contract, real state, pnpm web scope and existing verification.
- Linked it from `better-ui` and added attribution to `THIRD_PARTY_NOTICES.md`.
- Grouped all 18 project skills in `docs/development.md` and `docs/development.zh.md`; retained
  independent entrypoints and existing paths. Reviewed and recorded only that translation pair.
- Added the [integration decision](../notes/implemented/process/2026-09-26-libraries-dev-project-skill.md).

## Why

UI standards, concrete effect integration and browser acceptance have distinct triggers. Navigation
can group them without combining all instructions or disrupting existing skill discovery.

## Validation

- `quick_validate.py .agents/skills/libraries-dev`: passed.
- Seven reference files match the pinned global snapshot; MIT licence also matches pinned upstream.
- `pnpm verify:docs` and `pnpm verify:protected`: passed.
- `pnpm exec prettier --check` on changed Markdown: passed.
- `git diff --check`: passed.
- `check-pairs.mjs --record docs/development.md`: passed; pair structure and identifiers agree.
- Whole-repository `check-pairs.mjs`: ten unrelated document pairs have no review record. The
  development pair has no reported error; existing translation work is preserved.

## Notes for the next person

No application code or npm effect dependencies changed, so no browser E2E was needed. Effects need
an authorized implementation and must satisfy the current design contract. No commit or push was
requested. Existing dirty changes and the older dated audit log are preserved.
