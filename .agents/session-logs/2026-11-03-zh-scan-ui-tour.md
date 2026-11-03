---
date: 2026-11-03
author: Claude (retro thread, for Joey)
branch: feature/TP-351-zh-scan-ui-tour
pr: pending
area: apps/web, .agents/skills/ui-verification
contract-impact: none
---

# Chinese-interface English scan, one-command screen tour, Chinese map control labels (TP-351)

## What changed

- `apps/web/tests/e2e/support/ui-tour.mjs`: shared screen list and walker (mock Settings seed, example trip).
- `apps/web/tests/e2e/zh-latin-scan.e2e.mjs` (+ failures inventory): fails on English outside trip data in zh.
- `.agents/skills/ui-verification/scripts/tour.mjs` (+ failures inventory) and SKILL.md sections.
- `components/map/maplibre-renderer.ts`: MapLibre `locale` from new `messages/{en,zh}-map-controls.ts` (kept out of MessageKey: a new key there hits TS2590).

## Why

Retro 2026-11-03 B and E (Joey accepted): ~15 of 64 UI-loop rounds fixed one English leak each, and
every round rebuilt the screenshot setup by hand. The scan found two leaks still on main: the map's
"Map" and "Toggle attribution" labels.

## Validation

- `zh-latin-scan` on 5b8a642 (before #941, port 3001): FAIL, leaks "make the route geographically
  feasible" (Think), "geography conflict on day 1 …" (trip panel, phone Trip), map labels.
- Same on origin/main fb5a0df: FAIL on "Map", "Toggle attribution". On this branch: 25/25 pass.
- `tour.mjs --name check --dark`: 72 screenshots, every screen opened; `--bogus` exits 2; a down
  server exits 1 with the start command.

## Notes for the next person

The scan is a raw E2E script (not in CI's selected journeys); run it in UI rounds. Example prompts are
random, so destinations differ between runs. MapLibre reads the language when the map is created.
