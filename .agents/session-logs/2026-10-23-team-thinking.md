---
date: 2026-10-23
author: Claude
branch: feature/team-panel-634
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Open a specialist's thinking rows from the team panel (#634, spec #629)

## What changed

- `TeamPanel` takes `onSelect`; an involved row's name is a button ("Show {name} thinking"), Idle and
  Not involved rows have none. `TeamControl` and `PhoneTeamButton` close the panel or sheet and ask for
  the reveal.
- `team-run.tsx` holds a `reveal` request keyed by the run's activity list; `ThinkingProcess` matches it
  by identity, opens the fold and exactly the specialist's latest-round `Subagent` row (or the fold for the
  Coordinator), scrolls and focuses it. `SubagentRow` carries `data-subagent`.
- `.team-panel__press` joins the button reset lists in `forms.css`; string in `workspace-messages.ts`.
- `team-thinking` E2E with its failure inventory; `docs/workspace-ui.md`, `.zh.md` and the Agent Note.

## Why

Matching by activity identity avoids an index for the live area versus saved replies. The E2E slows the
`/api/chat` stream in the page so the live panel can be pressed mid-turn.

## Validation

See the report for this branch; commands are listed there.

## Notes for the next person

- Pressing replaces the open set of the fold with the fold and the one row.
