---
date: 2026-10-10
author: Codex
branch: main
pr: none
area: .agents/notes
contract-impact: none
---

# Record the agreed local test CLI scope

## What changed

- Added [a proposed test CLI note](../notes/proposed/testing/2026-10-10-local-test-cli.md) with confirmed scope, alternatives, acceptance criteria and risks.
- Kept CLI syntax, server mode and exact smoke membership open for the next interview round.
- No runtime, tests, root configuration or domain glossary changed; no commit or push.

## Why

- The user chose local testing, human and agent output, deterministic defaults, curated smoke and strict required-check outcomes.
- Existing runner and evidence paths can be reused, but tool mock mode does not disable models and fixed screenshot directories can overwrite evidence.
- The proposal preserves existing E2E-first and scenario-ownership decisions.

## Validation

- `pnpm exec prettier --write .agents/notes/proposed/testing/2026-10-10-local-test-cli.md`: passed.
- `pnpm verify:docs`: passed; Agent Notes, skills and Markdown links are valid.
- `pnpm verify:protected`: passed relative to origin/main.
- `git diff --check`: passed.
- Read-only code inspection only; no E2E or provider calls were executed.

## Notes for the next person

- Runtime documentation and affected skills need updates when implementation is approved and delivered.
- Preserve the pre-existing untracked `2026-10-07-bug-discovery-e2e.md` session log.
- This is a design proposal, not a shipped CLI or an implemented decision.
