---
date: 2026-10-11
author: Codex
branch: feature/local-test-cli-296
pr: 306
area: apps/web, docs
contract-impact: none
---

# Add fixture-backed journey collections to the local E2E CLI

## What changed

- Added default smoke, named multi-journey and all-supported CLI selection with serial execution and per-journey evidence.
- Added `agent-lab-replay` to the supported manifest and discovery listing; retained `journey.log` for single journeys.
- Documented collection selection and replay coverage in English and Chinese.

## Why

- Only journeys with complete, passing fixture execution and compatible server ownership belong in the supported manifest.

## Validation

- `node apps/web/tests/cli-e2e/local-cli-collections.e2e.mjs` — passed smoke, replay, multiple, all, unsupported and timeout cases.
- `node apps/web/tests/cli-e2e/local-test-cli.e2e.mjs` — passed foundation compatibility, cleanup and timeout/interruption checks.
- `node apps/web/tests/cli-e2e/discovery.e2e.mjs` — passed; verified doctor and the 43-script listing.
- `node apps/web/tests/cli-e2e/local-test-cli-repeat.e2e.mjs` — passed after preserving `evidence/<script>/` paths.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs` — passed.

## Notes for the next person

- Evidence remains under `output/e2e/local-test-cli/`; no provider credentials or calls were used.
