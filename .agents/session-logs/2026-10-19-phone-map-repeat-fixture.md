---
date: 2026-10-19
author: Codex
branch: fix/phone-map-repeat-fixture
pr: none
area: apps/web, docs
contract-impact: none
---

# Restore provider-independent phone map regression evidence

## What changed

- `phone-map.e2e.mjs` locates the exact place control in either map renderer or the error list, activates it with Enter and waits for selected stop/details.
- Removed the optional activation and first-stop substitution that could hide missing controls; exceptions now produce a failed summary entry.
- Separate `LABEL` directories retain attempts. Updated both `docs/e2e-known-failures` languages; no production changes.

## Why

- #367 reproduced on `2e0f506b`: the default no-key renderer successfully loaded OSM, but the old script queried only the renderer-error list.
- Ponytail full review kept all existing checks and used accessible controls rather than introducing renderer-specific helpers.

## Validation

- Environment: Node 26.8.1, pnpm 9.15.0, Chrome 155.0.8059.82; mock tools/data, blank model/Maps/Clerk keys, no Google mock.
- `CHANNEL=chrome LABEL=<attempt> DATA_MODE=mock USE_MOCK_TOOLS=true WEB_MAPS_PROVIDER=<provider> pnpm --filter @trip/web e2e phone-map`, child bound 180000ms.
- Baseline default: exit 1, 22/25 checks at 390px, then desktop timeout; 360px not reached. Runner `2026-10-19T12-19-03-896Z.json`.
- Earlier selection/popup races and loose ID matching were retained as failed attempts before correction.
- Negative control changed Day 2's place ID to a distinct suffix: default exit 1, 11/12; exact Day 2 control absent. Runner `2026-10-19T12-29-05-947Z.json`.
- Restored final fixture: default exit 0, 54/54, 12s; Google-only no-key exit 0, 54/54, 11s. Runners `2026-10-19T12-30-19-816Z.json`, `2026-10-19T12-30-47-324Z.json`.
- Each success covers 390×844, 360×800 and 1280×900 transitions, English/Chinese, dark mode, keyboard/drag and eight screenshots.
- Tested implementation/docs tree: `9560964aee7afafa880fde71719ee599c334cd6c`; this log is the only subsequent file addition.
- `pnpm --filter @trip/web test`: 632/632 tests in 57 files; web `typecheck` and `lint`: exit 0.
- `pnpm verify:docs`, `verify:protected`, `verify:pairs`, `verify:e2e-selectors`, `verify:e2e-artifacts`: exit 0.
- Scoped added-comment check against origin/main and `git diff --check`: exit 0.

## Notes for the next person

- Evidence lives under `output/playwright/phone-map/<attempt>/` and `output/e2e/runner/`; quote it in the PR before `pnpm clean:output`.
- No live Google/Clerk/provider quota, physical-device or production-server evidence. No merge authorization.
