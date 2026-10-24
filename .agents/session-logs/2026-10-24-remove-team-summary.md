---
date: 2026-10-24
author: Claude
branch: feature/remove-team-reply-summary
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Remove the per-reply team summary (Joey chose option A in thread)

## What changed

- Deleted `TeamSummary.tsx`, `TeamRunBar.tsx`, `teamSummary` and its type in `team-model.ts`, and the
  summary and run-bar CSS in `thinking.css`.
- `team-run.tsx` is renamed `team-reveal.tsx` and keeps only the press target; `Workspace.tsx` provides
  it. `use-team-surface.ts` now returns `{ team, select }` for the latest run only.
- `TeamControl.tsx`, `PhoneTeamButton.tsx` drop the run bar; `MessageItem.tsx` and `ChatPanel.tsx` drop
  the `index` and `turn` props.
- Removed translation keys: `{name} specialist`, `Coordinator + {count} specialists`, `1 round`,
  `{summary}, view assignments`, `Turn {n}`, `Latest turn`.
- E2E: deleted `team-summary.e2e.mjs` and its failure inventory; `support/team-run.mjs` `readRun` now
  opens the top bar button with the keyboard (hover would toggle it closed); the specialist, handoff,
  assistants-demo, team-thinking and team-panel-desktop scripts read the latest run instead of older
  replies and drop the summary fallbacks.
- Docs: `docs/workspace-ui.md` and `.zh.md` lose the reply summary bullet. Agent Notes: new
  `implemented/simplification/2026-10-24-remove-team-reply-summary.md`; the 2026-10-23 team panel note
  points at it.

## Validation

- `apps/web` `tsc --noEmit`, `next lint`, `pnpm --filter @trip/web test` (57 files, 642 tests): pass.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:e2e-selectors`, `check-ui-copy.mjs`, prettier
  check on changed files: pass.
- E2E in mock mode (`PLAYWRIGHT=/opt/node-tools/node_modules/playwright/index.js DATA_MODE=mock pnpm
  --filter @trip/web e2e <name>`): `team-thinking` (w1440, w800, w390), `team-panel-desktop`,
  `assistant-team-conversation`, `specialist-mention`, `assistants-demo`, `specialist-handoff`,
  `specialist-multi-mention`: all pass.

## Known limitations

- Earlier turns no longer open their own team panel; their work stays in the Think fold.
