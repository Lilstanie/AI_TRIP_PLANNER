---
date: 2026-10-24
author: Claude Sonnet 5.5
branch: fix/TP-72-trajectory-review
pr: none
area: apps/web, docs
contract-impact: none
---

# Fix the verified findings of the spec #667 code review (TP-72)

## What changed

- `components/chat/ChatPanel.tsx`: a Trajectory request seen at phone width is marked handled, so widening never replays it; returning to Conversation scrolls to the end when a message or activity arrived meanwhile.
- `components/chat/Disclosure.tsx`, `app/styles/thinking.css`: an expandable row's icon and title are a native button; the pressable summary is its sibling, not nested in a `role="button"`.
- `components/trajectory/timeline.ts`, `TrajectoryTimeline.tsx`: a range keeps only records whose span overlaps it, not ones that touch its edge.
- `components/trajectory/TrajectoryView.tsx`: the search index gets a stable layouts array.
- E2E: failure lines and checks in `trajectory-phone`, `trajectory-tab`, `trajectory-timeline`, `summary-jump`; selectors in `summary-jump` and `trip-display-currency` follow the toggle button; two component tests follow the new structure.
- Docs: Agent Notes `trajectory-tab` (adds the file-size exception for `TrajectoryTable.tsx` and its CSS), `summary-jump`, `phone-trajectory`; `workspace-ui` and `dsh-thinking-ui`, en and zh.

## Why

Findings 1, 2, 3, 7, 8 were real. 4 and 6 follow from the documented design (the phone ledger unmounts on tab switch, as the desktop one does, so a jump always meets a fresh ledger). 5 is the documented fallback to the conversation. 9 skipped: it runs only on a range change. 10 is documented, the copy stays whole.

## Validation

- `redgreen.mjs --base origin/feature/TP-72-trajectory`: trajectory-phone 79/82 then 82/82; trajectory-tab 94/96 then 96/96; trajectory-timeline 82/84 then 84/84; summary-jump failed (nested button) then 64/64.
- Other checks are listed in the final report of the session.

## Notes for the next person

- Playwright needed `PLAYWRIGHT_BROWSERS_PATH` pointing at a matching build.
- The timeline check pins the track to 1024 px so a drag lands exactly on a record boundary, then restores it.
