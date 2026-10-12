---
date: 2026-10-12
author: Codex
branch: docs/skill-301-refresh
pr: none
area: .agents/skills
contract-impact: none
---

# Align review, writing and wiring guidance with current contracts

## What changed

- `review-trip-planner/SKILL.md`: AUD planning versus browser/server display owners,
  authored Notices, terminal stale background work and specific error-subclass ordering.
- `better-writing/SKILL.md`: rendered day-view actions, formatter ownership and stored Notices.
- `end-to-end-feature-wiring/SKILL.md`: queued ownership, local retry versus stale refusal,
  interleaving evidence and browser-local limits; existing six-step workflow retained.
- Added this log only; renamed review entrypoint and task-scoped comment gate retained.

## Why

Ticket #301 under #300 corrects skill guidance after merged product fixes, not product behavior.
Started at integration commit d7cde6a; inspected history for #229, #258, #278 and #291,
current formatter/Notice/revision/error consumers and accepted Notes. Both context JSON files
have no comments. Existing workflow and testing decisions are reused; no new lasting decision.

## Validation

- Semantic inspection: linked code/Notes match money precedence, stored edit Notices,
  rendered actions, local discard versus terminal cross-tab refusal and 503-before-404 ordering.
- `node scripts/verify-docs.mjs`: passed Notes, skill format and Markdown links.
- `node .agents/skills/skill-maintenance/scripts/check-skills.mjs review-trip-planner better-writing end-to-end-feature-wiring --json`:
  passed; no missing paths, broken commands or named-path drift in these three skills.
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs`: passed all 26 pairs.
- Primary repo's `pnpm exec prettier --write` on the three scoped skill paths: passed.
- `git diff --check`: passed. No tests added or application/browser suites run for prose.

## Notes for the next person

Parent owns integration docs/development.md + zh, translation-pairs and full-review checkpoint.
No bilingual page or new Agent Note is required by this scoped correction; parent may describe
these skill updates in its shared documentation. Structural success is not runtime coverage.
Post-commit protection/format results and integration merge SHA are reported in the handoff.
