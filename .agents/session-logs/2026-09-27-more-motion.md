---
date: 2026-09-27
author: Claude Code
branch: feature/more-motion
pr: none
area: apps/web, docs
contract-impact: none
---

# Per-subagent thinking orbs and timeline motion

## What changed

- `ThinkingOrbIcon.tsx`: `subagentOrbState` and `SubagentOrbIcon`; `ThinkingRows.tsx` shows the orb
  on running Subagent rows, from that specialist's own latest step.
- `useTimelineEdits.ts` tracks the stops an applied edit changed (cleared after 1.6 s);
  `TimelineStop` marks them; `TripEditor` keys the day list and each connection by day and status.
- `timeline.css`: changed-stop wash and node pop, checked-journey rail draw, editor, review panel
  and undo bar entrances, all off under reduced motion; tokens only, `transform`/`opacity`/fills.
- E2E: `thinking-orb.e2e.mjs` checks subagent orbs; `timeline.e2e.mjs` checks the changed-stop
  and rail animations. Docs: `workspace-ui.md` and its Chinese pair.

## Why

The owner asked for more animation after the Think row orb; both additions follow real state.

## Validation

- `pnpm --filter @trip/web test` 371 passed; typecheck and lint clean.
- `thinking-orb.e2e.mjs`: all checks pass in 4 contexts, 5 subagent orbs while running, none after.
- `LABEL=motion timeline.e2e.mjs`: all checks pass, including the highlight and rail draw.

## Notes for the next person

A dev server started before switching branches can serve a stale "file not found" for a new
component; restart it.
