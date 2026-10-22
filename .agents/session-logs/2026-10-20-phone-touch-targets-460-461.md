---
date: 2026-10-20
author: Codex
branch: fix/phone-touch-targets-460-461
pr: none
area: apps/web, docs
contract-impact: none
---

# Phone Map and Trip touch targets

## What changed

- `phone-shell.css`: one phone-only rule makes Map day chips and Trip budget/tips summaries at least 44 px tall; native disclosure layout stays intact.
- `phone-map.e2e.mjs` and its failure inventory: EN/ZH geometry, focus, disclosure and overflow checks at 320/375/390/400/520 px, desktop summaries at 521/1440 px, existing map ownership checks.
- `docs/workspace-ui.md` and its Chinese pair describe the phone target heights.
- Reproduced and triaged #460/#461 as enhancement/ready-for-agent after duplicate and prior-rejection searches; each has one AI-prefixed Agent Brief.

## Why

The generic button rule overrode the existing map-day minimum with 36 px. Trip summaries were 21 px. The phone-state selector restores the existing 44 px target contract without component changes.

## Validation

- Base: `b62750d711488689763d48bd757a52e9cd49f752` (latest origin/main, includes #443/#467).
- `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true LABEL=before-final pnpm --filter @trip/web e2e phone-map`: exit 1; 255/285 assertions, exactly 30 target-size failures (36/21/21 px).
- Same command with `LABEL=after`: exit 0; 285/285 assertions, no skips; targets 44/44/44 px, desktop summaries unchanged at 21 px. Runner IDs: `2026-10-20T11-42-57-410Z`, `2026-10-20T11-43-54-228Z`.
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed; no new unit tests.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint`: passed.
- `pnpm verify:docs`, `pnpm verify:pairs` (27 pairs), `pnpm verify:protected`: passed.
- `pnpm verify:e2e-artifacts` (78 scripts), `pnpm verify:e2e-selectors`: passed.
- `node .agents/skills/review-trip-planner/scripts/check-added-comments.mjs --base origin/main --path apps/web/tests/e2e/phone-map.e2e.mjs`: no violations.
- `node --check apps/web/tests/e2e/phone-map.e2e.mjs` and `git diff --check`: passed.
- Inspected 320 px EN/ZH and 520 px ZH screenshots and desktop fallback screenshot; focus rings, native markers and sheet layout remain visible.
- Runtime: Node 26.8.1, pnpm 9.15.0, Google Chrome 155.0.8059.85. E2E uses mock data and deliberately disables WebGL for repeatable fallback ownership checks.

## Notes for the next person

- Earlier setup/fixture runs failed on missing browser, locale locators or an invalid fallback assumption when OSM rendered; final equivalent before/after fixture runs above supersede partial evidence.
- Ponytail full self-review: seven production CSS lines, no helpers/dependencies/protected config changes; independent reviews deferred to parent. No subagent capability was available to select Luna high.
- No live renderer/provider or physical-device proof. Root's unrelated dated log and other worktrees were preserved. Parent owns #464 and integration; do not merge this branch.
- Quote evidence in the draft PR before `pnpm clean:output`; regenerate screenshots with the command above. No Agent Note needed: existing phone sizing contract is restored.
