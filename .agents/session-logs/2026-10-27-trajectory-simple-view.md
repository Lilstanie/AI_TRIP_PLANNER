---
date: 2026-10-27
author: Claude Code
branch: feature/TP-111-simple-trajectory
pr: none
area: apps/web, docs
contract-impact: none
---

# Simple trajectory view as the default (#735, TP-111)

## What changed

- `components/trajectory/TrajectorySimple.tsx` and `simple.module.css`: one row per turn with message summary, specialist avatars and result; an open row lists its steps and assignments.
- `TrajectoryTab.tsx`: Simple and Full view switch, the open turn carried into the ledger as a jump, simple list as the default on desktop and phone.
- `lib/trajectory/adapter.ts`, `layout.ts`, `locales.ts`: `summary`, `result` on each turn and `round` on each step group; English and Chinese labels. Both views read the same `buildTrajectory` turns.
- E2E: failures listed first in `trajectory-tab.failures.md` and `trajectory-phone.failures.md`; `trajectory-tab`, `trajectory-phone`, `trajectory-empty` and `trajectory-demo` assert the simple list; `trajectory-inspector`, `trajectory-timeline`, `summary-jump`, `team-panel-desktop` and `team-thinking` press Full view first.
- Docs: `docs/workspace-ui` (+ zh), `docs/demo-runbook` (+ zh), `GLOSSARY.md`; new Agent Note `2026-10-27-trajectory-simple-default.md` that partly supersedes the 2026-10-24 trajectory-tab note.

## Why

The ledger is a debugging table; travellers need a readable default. See the Agent Note.

## Validation

See the pull request evidence.

## Notes for the next person

`trajectory-tab` fails on the last check ("a reply that arrived on the Trajectory tab is in view when Conversation returns", gap 365) before and after this change.
