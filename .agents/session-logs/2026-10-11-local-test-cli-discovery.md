---
date: 2026-10-11
author: Codex
branch: feature/local-test-cli-295
pr: none
area: apps/web/tests/e2e, docs/local-test-cli.md
contract-impact: none
---

# Add offline doctor and script discovery

## What changed

- Added `doctor` checks for Node, pinned pnpm, Next, Playwright Chromium, and app dotenv-file presence.
- Added `list` support/prerequisite/exclusion output, sharing the supported-name set with local `run`.
- Added public CLI E2E evidence for ready/blocked diagnosis, redaction, support boundaries, and unchanged env/evidence files.
- Updated the paired English/Chinese CLI guide and reviewed pair hashes.

## Why

- `doctor` checks pnpm through Corepack with network/download prompts disabled and a small environment allowlist.
- `list` names partial model skips and multiple-server boundaries so a script cannot look locally complete by default.

## Validation

- `node apps/web/tests/cli-e2e/discovery.e2e.mjs` — passed; ready/blocked results and 43 scripts; async subprocesses left the inherited-server sentinel at zero after a separate control request was detected; evidence `/var/folders/my/p6d5z66d0q1970drb231xkbc0000gn/T/ai-trip-planner-local-test-cli-evidence/discovery-1791640878081-88678.json`.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm verify:e2e-selectors`, `pnpm format:check-changed origin/main` — passed.
- Prettier and `node --check` for changed JavaScript files — passed.

## Notes for the next person

- The supported list currently names only `agent-lab-single-agent`; sibling collection work should extend `SUPPORTED_SCRIPT_NAMES` so `list` and `run` remain aligned.
- `list` is inventory, not test evidence. Scripts without a support audit remain excluded.
