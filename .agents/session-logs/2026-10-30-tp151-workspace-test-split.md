---
date: 2026-10-30
author: Codex
branch: feature/TP-151-new-chat
pr: none
area: apps/web, docs
contract-impact: none
---

# Split Workspace map-places tests under the file-size limit

## What changed

- Moved the existing `Workspace map places` suite into
  `apps/web/tests/components/workspace/Workspace.map-places.test.tsx`.
- Left `Workspace.test.tsx` at 973 lines and restored the excluded Intl WIP as unstaged.

## Why

Independent Standards on `91123863` failed because the PR modified the already oversized
`Workspace.test.tsx` without the required incremental split.

## Validation

- `pnpm --filter @trip/web exec vitest run tests/components/workspace/Workspace.map-places.test.tsx tests/components/workspace/Workspace.test.tsx --reporter=dot` → 40/40 pass.
- Product E2E evidence remains the docs/test-only successor of `daf2b201` / `91123863`.

## Notes for the next person

- Keep the Intl WIP out of this ticket.
- No push, integration merge, Jira, Astra, or protected-config change from this worktree.
