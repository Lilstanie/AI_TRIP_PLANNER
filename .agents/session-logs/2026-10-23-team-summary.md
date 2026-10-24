---
date: 2026-10-23
author: Claude
branch: feature/team-panel-633
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Reply summary that opens that run's team panel (#633, spec #629)

## What changed

- New `TeamSummary` (one-line button under each reply a specialist worked on), `teamSummary` in
  `team-model.ts`, `team-run.tsx` (which run the panel shows) and `TeamRunBar` (Turn N label, Latest turn).
- `TeamControl` reads the chosen run, pins on a summary press and returns to the latest run on close or
  on the next live turn; `Workspace.tsx` provides the state; `ChatPanel` passes the turn number.
- Deleted `TeamConversation`, `team-messages.ts` and their CSS; strings in `workspace-messages.ts`.
- `team-summary` E2E with its failure inventory and `support/team-run.mjs`; the team-conversation
  scripts (`assistant-team-conversation`, `assistants-demo`, `specialist-handoff`, `specialist-mention`,
  `specialist-multi-mention`) now read the panel through the summary.
- `docs/workspace-ui.md` and `.zh.md`; the Agent Note's consequences.

## Why

The summary's accessible name ends "view assignments", not "open the specialist team", so it never
matches the top bar button's name in role queries.

## Validation

See the pull request evidence; commands are listed in the report for this branch.

## Notes for the next person

- At phone width the panel opens only once #632's bottom sheet exists; until then those scripts check
  the summary instead of the panel.
