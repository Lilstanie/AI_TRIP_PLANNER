---
date: 2026-10-20
author: Codex
branch: fix/phone-map-fixture-merge-audit
pr: 458
area: apps/web, docs
contract-impact: none
---

# Verify both phone map renderer paths after integration

## What changed

- Integrated main through `e0488912`; resolved only adjacent English/Chinese regression documentation, preserving both entries.
- The fixture explicitly requires a ready OSM canvas by default and the error list for Google-only with no key.
- Preserved exact repeated-place ownership, Enter activation, selected stop/details waits and explicit failure recording.

## Validation

- Implementation/docs commit `9e1ae151c4c963504bb5cd068172da1456ed8072`, tree `e72d95448b47ea3f2b66bc2382049b83c7f860e7`; this log is the only subsequent addition.
- E2E ran on parent `6b11964c` with exactly the committed fixture patch; subsequent changes were paired documentation only.
- `CHANNEL=chrome LABEL=renderer-proof-default DATA_MODE=mock USE_MOCK_TOOLS=true E2E_SCRIPT_TIMEOUT_MS=180000 pnpm --filter @trip/web e2e phone-map`: exit 0, 56/56, 12s; runner `2026-10-20T12-19-33-055Z.json`.
- Same command with `LABEL=renderer-proof-google WEB_MAPS_PROVIDER=google`: exit 0, 56/56, 11s; runner `2026-10-20T12-20-06-804Z.json`.
- Earlier integrated runs before renderer assertions: default 54/54 and Google-only 54/54, both exit 0. Original baseline and negative control failures remain documented in the prior log and PR body.
- Node 26.8.1, pnpm 9.15.0, Chrome 155.0.8059.85; blank model/Maps/Clerk keys, mock tools/data, isolated dev servers/configs. Default uses real MapLibre with an empty mock style; Google-only exercises the missing-key error list.
- `pnpm --filter @trip/web run test --maxWorkers=2`: 642/642, 57 files, exit 0; existing jsdom canvas diagnostics remain non-failing.
- Web `typecheck` and `lint`; `pnpm verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `format:check-changed origin/main`; scoped added-comment checker and `git diff --check`: exit 0.

## Notes for the next person

- Artifacts: `output/playwright/phone-map/renderer-proof-{default,google}/` and `output/e2e/runner/`; quote before cleanup.
- No live provider, real Google map, Clerk, physical-device or production-server acceptance is claimed.
