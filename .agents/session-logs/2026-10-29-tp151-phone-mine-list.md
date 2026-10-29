---
date: 2026-10-29
author: Codex
branch: feature/TP-151-new-chat
pr: none
area: apps/web, docs
contract-impact: none
---

# TP-151 phone Mine list for ordinary New chat

## What changed

- Mine empty-state now uses `HistoryItem.untouched` instead of title heuristics.
- Ordinary Chats titled New chat stay listed and reopenable during and after generation.
- Failure inventory #14 and phone Mine reopen assertions cover the regression.
- Paired empty-state and New chat notes/docs describe the collection-membership rule.

## Validation

- Prior WIP preserved; no stash/reset. Integration tip remains `95c80303` via `d34e1e4b`.
- Red Chinese composer locator: `output/e2e/local-test-cli/2026-10-29T12-25-48-565Z-99632-0hvcqm`.
- Green focused new-chat: `output/e2e/local-test-cli/2026-10-29T12-29-15-919Z-4744-seuvh5`.
- Exact-HEAD dependents, guards and Spec/Standards/Ponytail evidence: `/tmp/tp151-delivery/`.

## Notes for the next person

- Controlled mock streams only; live providers and physical devices unverified.
- Do not stage #795 action-panel files, proposed-spec formatting, node_modules or tsconfig scratch.
- No push, comment, Jira update, merge, branch deletion, Astra or protected-config change.
