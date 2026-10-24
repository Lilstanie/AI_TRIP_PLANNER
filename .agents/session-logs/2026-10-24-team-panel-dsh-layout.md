---
date: 2026-10-24
author: Claude Sonnet 5.5
branch: feature/TP-75-team-panel
pr: none
area: apps/web, docs, THIRD_PARTY_NOTICES.md
contract-impact: none
---

# Team panel in DSH's roster and task board layout (#671, TP-75)

## What changed

- `components/chat/TeamPanel.tsx` and `TeamPanel.module.css`: adapted from DSH `TeamAction` (MIT header): Members
  cards and Assignments task cards; the old `team-panel__*` hook classes stay for the E2E scripts.
- `components/trajectory/shim.tsx`, `shim.module.css`: DSH `StateDot` and `Tag`, chevron icon.
- `components/chat/trajectory-focus.tsx` (renamed from `team-reveal.tsx`), `use-team-surface.ts`, `ChatPanel.tsx`,
  `TrajectoryTab.tsx`: a card press opens the Trajectory tab filtered to that assistant, with a bar to clear it.
- `lib/trajectory/adapter.ts` (`only`), `trajectory-record.ts`, `TrajectoryTable.tsx` (`data-assistant`).
- `ThinkingProcess.tsx` no longer reacts to a panel press; `PhoneTeamButton.tsx` cards have no action yet.
- E2E: `team-panel-desktop` and `team-thinking` rewritten with their failure inventories; `support/team-run.mjs`.
- Docs: `workspace-ui` en and zh, `THIRD_PARTY_NOTICES.md`, `comment-exceptions.json`, new Agent Note
  `implemented/feature/2026-10-24-team-panel-dsh-layout.md` (supersedes parts of the 2026-10-23 note).

## Why

DSH shows the team as a roster and a task board; the press now leads to the whole-chat trajectory instead of a
second thinking view. The filter sits in the adapter so the copied ledger stays unchanged.

## Validation

- `scripts/redgreen.mjs --base origin/feature/TP-72-trajectory team-thinking`: before 2/8 ok (failed), after 40/40 ok.
- Same for `team-panel-desktop`: before 7/7 ok then failed, after 161/161 ok (1440 and 800 en, 1440 zh, screenshots and JSON).
- Also green: `trajectory-tab`, `team-panel-phone`, `decided-by-badge-final`, `assistants-demo`,
  `assistant-team-conversation`, `specialist-handoff`, `specialist-mention`, `specialist-multi-mention`.

## Notes for the next person

- The phone sheet cards are disabled until the phone trajectory (#672) exists; wire `onSelect` there.
- A conflict check belongs to the specialists it names; the stop reason shows only unfiltered.
- `thinking-disclosure` needs a Chrome channel that this sandbox lacks, so it was not run.
