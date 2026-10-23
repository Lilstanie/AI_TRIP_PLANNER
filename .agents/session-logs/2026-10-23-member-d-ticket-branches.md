---
date: 2026-10-23
author: Codex
branch: fix/TP-43-dietary-restaurant-search
pr: none
area: packages/agents, packages/orchestrator, packages/tools, packages/shared, docs, apps/web/tests
contract-impact: packages/shared
---

# Split member D's work into one branch per Jira ticket

## What changed

- TP-39: `fix/TP-39-weather-capabilities` from main, commit `bf86e57b`.
- TP-38: `fix/TP-38-trip-weather-coverage` from main, commit `ceeca197`.
- TP-37: `fix/TP-37-weather-packing` based on TP-38, commit `709b89e5`.
- TP-41: `fix/TP-41-chat-dietary-needs` from main, commit `aff78ede`.
- TP-43: current branch based on TP-41; adds optional `PlaceQuery.textQuery`, adapter forwarding
  and search progress. Its [contract decision](../notes/implemented/bug-fix/2026-10-23-dietary-restaurant-search.md)
  accompanies this PR-sized diff. Every branch updates the relevant bilingual documentation.
- The original combined commit `a8a446ae` remains on local `fix/weather-dining-integration` only.
  It is a backup, not a proposed PR. Jira ownership and In Progress states remain unchanged.

## Validation

- TP-39: coordinator prompt E2E 1 passed; existing capabilities tests 3 passed.
- TP-38: coverage/cache and existing planning E2Es 4 passed; agents 144, tools 141 passed;
  agents/tools/orchestrator typechecks, docs and translation checks passed.
- TP-37: packing workflow E2Es 3 passed, agents 144 passed; agents/orchestrator typecheck and lint,
  docs and translation checks passed. Chrome browser E2E: 16 checks passed at desktop/phone widths
  in English/Chinese; artifacts under `output/playwright/TP-37/split-TP-37/`.
- TP-41: dietary workflow E2Es 4 passed, agents 144 passed; agents/orchestrator typecheck and lint,
  docs and translation checks passed.
- TP-43: search plus dietary E2Es 6 passed, tools 141 and shared 58 passed; `pnpm typecheck`,
  `pnpm lint`, `pnpm verify:pairs` and `pnpm verify:protected fix/TP-41-chat-dietary-needs` passed.
- Native Windows docs verifier has an existing separator bug; the unchanged verifier passed with
  temporary slash-normalized Node `join`/`relative`. No protected scripts were edited.

## Notes for the next person

Open each PR against its stated base, so dependent PRs show only one ticket's diff. No branch was
pushed and no PR opened: local Git authentication was cancelled. Preserve evidence until PR bodies
quote it. Original combined-tree build/CI claims must not be substituted for split-branch checks.
Live-provider reliability, model wording and prompt-token usage remain unmeasured. No merge authorized.
