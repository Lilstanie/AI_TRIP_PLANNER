---
date: 2026-10-12
author: Codex
branch: docs/skill-302-refresh
pr: none
area: .agents/skills
contract-impact: none
---

# Refresh map-provider, layout and UI-verification skills (#302)

## What changed

- `better-ui/SKILL.md`: Google/OSM photo absence, Commons credits and persistence boundary.
- `better-layout/SKILL.md` and `references/spacing-and-adaptivity.md`: split-derived drawer widths,
  floating gaps, responsive modes and representative narrow-container checks.
- `break/SKILL.md` and `references/scenarios.md`: current components and provider-specific scenarios.
- `ui-verification/SKILL.md`: renderer/provider, configuration and fixture/stub/live evidence scope.
- `add-provider/SKILL.md` and new `references/web-map-providers.md`: route planning versus Web
  ownership; preserve search, language/cache, IDs, saved coordinates, profiles and typed failures.

## Why

Reused existing phone-shell and planning-gateway guidance. Compared requirements and empty comment
arrays in the #300/#302 context JSON with merged code and Agent Notes; no product behavior changed.
Started clean at integration commit `d7cde6a`; inspected #258/#278/#291/#292 and later history.
Read-only `gh pr view 278 --repo Lilstanie/AI_TRIP_PLANNER --json number,state,mergedAt,mergeCommit,title,body`
confirmed MERGED at `1ba51aa`; verified the current implementation rather than replaying old designs.

## Validation

- Semantic inspection: `PlacePreview`, split CSS/`SplitResizer`, Web providers/HTTP handlers,
  locale lookup consumers, save/Undo paths and existing map E2E scripts match the new instructions.
- `node scripts/verify-docs.mjs`: passed (notes, skill format and Markdown links).
- `node .agents/skills/skill-maintenance/scripts/check-skills.mjs --json better-ui better-layout break ui-verification add-provider`:
  passed; all five have zero missing paths/broken scripts. Pre-commit history prompts were reviewed.
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs`: passed, 26 pairs; no markers edited.
- Scoped `pnpm --dir /Users/joey/AI_TRIP_PLANNER exec prettier --write <absolute changed Markdown paths>`:
  passed using installed binaries; primary repository files untouched.
- `git diff --check`: passed. Committed-diff protection and final integration check are in the handoff.

## Notes for the next person

No browser/live-key run, new test or application suite: prose-only scope uses existing guards.
All seven #302 criteria map to the five skills and supporting references above.
No new architectural decision; existing implemented notes remain authoritative. Parent owns shared
navigation/bilingual development docs, any umbrella Agent Note and completed-full-review audit.
This partial update is not a completed full review and must not advance that checkpoint.
