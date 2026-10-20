---
date: 2026-10-20
author: Codex
branch: fix/question-phone-touch-targets
pr: none
area: apps/web, docs
contract-impact: none
---

# Phone question controls use 44 px touch targets

## What changed

- `apps/web/app/styles/question.css`: at ≤520 px, four icon targets are 44 × 44 px,
  footer buttons are at least 44 px tall, and collapse/dismiss have a 12 px gap.
- `apps/web/tests/e2e/question-touch-targets.inventory.md` and its E2E script were written
  before the CSS patch; no new unit tests. SVG sizes and larger-width controls are unchanged.
- Updated `docs/workspace-ui.md` and its Chinese pair; no Agent Note is needed.

## Validation

- Base: `b62750d711488689763d48bd757a52e9cd49f752` (merged #467 and #443).
- `EVIDENCE_LABEL=before CHANNEL=chrome USE_MOCK_TOOLS=1 pnpm --filter @trip/web e2e question-touch-targets`:
  exit 1, 156/180 checks; 24 expected phone dimension/gap failures.
- Same command with `EVIDENCE_LABEL=after`: exit 0, 180/180, zero skips; Chrome 155.0.8059.85,
  Node 26.8.1, pnpm 9.15.0; model, Maps and Clerk credentials blank.
- EN/ZH: 320×568, 390×844, 520×844, 521×844, 1440×1000; first/last screenshots,
  geometry, hit testing, overlap/overflow, SVG sizes, pager, collapse, keyboard expand,
  skip, submit, dismiss and browser errors. Artifacts: `output/playwright/question-touch-targets/`.
- `pnpm --filter @trip/web test`: 57 files / 642 tests passed; jsdom canvas warnings.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint`: exit 0.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`: passed (27 pairs).
- `pnpm verify:e2e-artifacts`, `pnpm verify:e2e-selectors`: passed (79 artifact writers).
- Scoped added-comment check against `origin/main`: no violations; `git diff --check` passed.

## Notes for the next person

- #466 triaged enhancement / ready-for-agent; no duplicate or prior rejection found.
- Fixture responses exercise the real workspace; no live-model, auth, physical-device or keyboard proof.
  Location prompt is dismissed; development badge hidden. Parent owns #464 and independent review.
- Initial bundled Chromium was missing; installed Chrome used instead. Earlier harness runs corrected
  last-skip setup and location-prompt interference. One completed run stalled closing Chrome;
  final script bounds shutdown to five seconds. Earlier logs remain in the evidence archive.
- No subagent capability was exposed, so parallel Luna-high review was unavailable. No merge performed.
