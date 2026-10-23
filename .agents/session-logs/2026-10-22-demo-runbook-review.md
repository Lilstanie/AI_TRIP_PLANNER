---
date: 2026-10-22
author: Codex
branch: docs/demo-runbook
pr: 529
area: docs
contract-impact: none
---

# Correct demo runbook evidence and fallback boundaries

## What changed

- Reviewed `docs/demo-runbook.md` and its Chinese pair against data-mode, auth,
  account and map-provider owners; corrected offline, storage and configuration claims.
- Separated original rehearsal disk sizes and timings from unmeasured cold-download claims.
- Kept original frozen session history unchanged.

## Validation

- Node v26.8.1; pnpm 9.15.0.
- `pnpm install --frozen-lockfile --offline`: exit 0, 585 packages reused, no downloads.
- `pnpm exec prettier --write docs/demo-runbook.md docs/demo-runbook.zh.md`: exit 0.
- `pnpm verify:docs`: exit 0, notes, skills and Markdown links valid.
- `pnpm verify:pairs`: exit 0, 28 pairs checked against origin/main.
- `pnpm verify:protected`: exit 0.
- `pnpm format:check-changed origin/main`: exit 0.

## Notes for the next person

- Documentation-only review; application build, browser and offline venue rehearsal were not rerun.
- Original author's timings and endpoint results remain historical evidence, not current-head runs.
- Retro: semantic documentation review caught claims outside automated pair/link checks;
  retain explicit measured-versus-inferred evidence boundaries. No new guardrail needed for this prose fix.
