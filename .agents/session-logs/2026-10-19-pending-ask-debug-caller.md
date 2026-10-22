---
date: 2026-10-19
author: Codex
branch: fix/pending-ask-progress
pr: 448
area: apps/web
contract-impact: none
---

# Keep debug question callers visible

## What changed

- `ChatPanel` renders pending questions when progress persistence is not configured.
- `pending-ask-refresh` covers the development debug page at phone and desktop widths.

## Why

The progress callback is optional, but gating the question UI on it hid the debug page's pending question.

## Validation

- `CHANNEL=chrome pnpm --filter @trip/web e2e pending-ask-refresh` — initially failed on both widths, then passed with 29 assertions and no browser errors. Artifact: `output/e2e/runner/2026-10-18T17-01-44-658Z.json`.
- `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter @trip/web test` — 57 files, 632 tests passed; jsdom canvas warnings remain.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint` — results recorded after completion below.

## Notes for the next person

- Await current-head CI; do not merge without explicit user instruction.
