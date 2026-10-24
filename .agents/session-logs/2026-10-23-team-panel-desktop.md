---
date: 2026-10-23
author: Claude
branch: feature/team-panel-631
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Specialist team button and panel on desktop (#631, spec #629)

## What changed

- `team-model.ts` now derives a team model (six rows, assignments, checks, working count) from an
  activity list; the old message list moved to `team-messages.ts` for saved replies until #633.
- New `TeamControl` (top bar button, hover, pin, Escape, outside press) and `TeamPanel` (takes a run's
  activity); `checkText` moved to `team-check.ts`. The live `TeamConversation` is gone from `ChatPanel`.
- Panel styles in `thinking.css`; strings in `workspace-messages.ts`.
- `team-panel-desktop` E2E with its failure inventory; `decided-by-badge-final` now samples the panel.
- `docs/workspace-ui.md` and `.zh.md`; Agent Note for the whole #629 decision.

## Why

An assignment's marker follows the specialist's own reasoning, and the Coordinator row keeps the
dispatch marker, so both decisions stay visible. The panel falls back to the newest saved reply's
activity because live activity is cleared once the reply is stored.

## Validation

- `pnpm e2e team-panel-desktop` (DATA_MODE=mock): all checks pass at 1440 and 800 in en and 1440 in zh.
- `pnpm e2e decided-by-badge-final assistant-team-conversation`: pass.

## Notes for the next person

- #632, #633 and #634 reuse `teamModel` and `TeamPanel`; the `onSelect` hook for #634 is not added yet.
- The Think fold is not shown for a settled live turn, so the panel reads the stored activity.
