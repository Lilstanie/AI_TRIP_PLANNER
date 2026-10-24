---
date: 2026-10-24
author: Claude Sonnet 5.5
branch: feature/TP-77-summary-jump
pr: none
area: apps/web, docs
contract-impact: none
---

# Reply summary opens its turn in the trajectory, and demo walkthrough (#673, TP-77)

## What changed

- `components/chat/Disclosure.tsx`, `ThinkingProcess.tsx`, `MessageItem.tsx`, `app/styles/thinking.css`: a finished reply's summary is a button that files an `openTurn` request.
- `components/chat/trajectory-focus.tsx`: the request carries an optional assistant and an optional turn.
- `components/chat/ChatPanel.tsx`, `workspace/PhoneTrajectory.tsx`, `trajectory/TrajectoryTab.tsx`, `TrajectoryView.tsx`: apply the jump on desktop and phone, clear the filter, unfold and focus the turn's first record.
- `lib/trajectory/adapter.ts`: `messageTurns` numbers each message with its turn.
- E2E: `summary-jump` and `trajectory-demo`, each with a `.failures.md`.
- Docs: `demo-runbook` and `workspace-ui` en and zh, Agent Note `implemented/feature/2026-10-24-summary-jump.md`.

## Why

The last ticket of spec #667: the summary line was the missing way into the trajectory, and the Stage 2 demo needed a trajectory walkthrough record.

## Validation

- `redgreen.mjs --base origin/feature/TP-72-trajectory summary-jump`: before 1/2 ok (failed), after 60/60 ok (passed).
- `redgreen.mjs --base origin/feature/TP-72-trajectory trajectory-demo`: before 3/3 ok (failed), after 40/40 ok (passed).
- Also run and passing: `trajectory-tab`, `trajectory-timeline`, `trajectory-inspector`, `trajectory-phone`, `team-panel-desktop`, `team-panel-phone`, `team-thinking`, `assistants-demo`, `assistant-team-conversation`, `phone-shell`, `phone-touch-targets`, `assistant-rename`.
- `phone-touch-targets` and `assistant-rename` clicked the middle of the Think row, which is now the summary; they click the Think label.
- Failing without this change: `progress-line-outcome` (same 6/8 on the base) and `thinking-orb` (listed in e2e-known-failures). `thinking-disclosure` needs the Chrome channel, absent here, so it did not run.
- `pnpm typecheck`, `pnpm lint`, `verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `check-ui-copy` and the added-comment check pass.

## Notes for the next person

- Playwright wants build 1194 and the sandbox has 1243; `PLAYWRIGHT_BROWSERS_PATH` pointed at a copy.
- On desktop the team panel opens on hover; a script must move the mouse away before hovering again.
- The mock summary reads "5 subagents", not the "协调员 + 3 位专家 · 2 轮" wording of the ticket.
