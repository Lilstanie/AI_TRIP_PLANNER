---
date: 2026-09-22
author: DeepSeek Harness agent
branch: fix/ui-interaction
pr: none
area: apps/web, packages/shared, packages/orchestrator
contract-impact: packages/shared
---

# Remove the decision and question apparatus

## What changed

- `packages/shared/src/plan.ts` — `HitlCheckpoint` and `TripPlan.hitl` removed. `SectionStatus` and
  `TripSection` stay.
- `packages/shared/src/chat.ts` — `ChatQuestion` and `ChatNeedsInfo.asked` removed. `ChatNeedsInfo`
  stays as the "not enough to plan yet" frame: the assistant's question plus the known fields.
- `packages/orchestrator` — `src/hitl.ts` (`checkpointsFor`, `applyHitl`) deleted, along with its
  export; `workflow.ts` no longer builds checkpoints and derives `TripSection.status` from whether a
  conflict targets the section; `chat.ts` loses `AskUserInput`, the `ask_the_traveller` tool,
  `AskedQuestionError` and the `pendingDecisions` digest; `tests/hitl.test.ts` deleted.
- `apps/web` — `app/api/hitl/route.ts`, `components/trip/CheckpointCards.tsx`,
  `components/chat/QuestionPrompt.tsx`, `app/styles/question.css` and their tests deleted; the
  client `Decision` path, the `question`/`answerQuestion` state and the `kind: "decision"` request
  are gone; `TripPanel` no longer renders "Stays and confirmations"; `catalog.ts` derives a trip's
  label from real state; `trip-edit.ts` no longer rebuilds decisions.
- Docs: `workspace-ui.md` "Decisions and review" became "Reviewing a plan", and
  `design/dsh-thinking-ui.md` §3.2 records that the app asks nothing in a structured form.

## Why

There is no feature that applies a traveller's decision — `applyHitl` re-priced a stay and flipped a
status, and nothing downstream acted on a confirmation. A checklist of things to approve therefore
offered a capability the app does not have, and the confirmation gate meant the plan could sit
"awaiting review" forever with no way to resolve it. The product owner's instruction was to remove it
rather than re-house it: if the traveller wants a change they say so in chat, or edit the trip.

## Validation

- `pnpm test` — 476 passed across 44 files (shared 29, services 4, tools 82, agents 95, orchestrator
  70, web 199). The orchestrator count drops by 6 and web by 17 because the checkpoint, question and
  applyHitl suites were deleted with their subjects.
- `pnpm typecheck` — 6/6 tasks. `pnpm lint` — no warnings or errors.
- `apps/web` production build — compiled successfully.
- Backward compatibility: a plan stored before this change still carries a `hitl` array. Zod strips
  the unknown key, and `apps/web/tests/lib/workspace/workspace.test.ts` pins that a legacy snapshot
  loads with no `hitl` property rather than failing.
- Browser (live provider, then the Trip drawer opened): zero `.checkpoint` elements, and none of
  `Confirm your trip basics`, `Confirm this plan`, `Review unresolved conflicts` or
  `Stays and confirmations` anywhere in the document; no console error. The coordinator's open
  question arrived as prose — "One thing still open: getting around… How are you planning to travel
  to Sydney — flying, driving, or already there?" — and the traveller answers it by typing.

## Follow-up in the same session

The todo dock (`TodoPanel`, `todos.css`, `ChevronIcon`'s only other consumer `ChecklistIcon`) was
removed too. It had been built for the decision checkpoints, so once those went it could only report
work nothing was doing, and its per-status counts duplicated the Think row's count line.

`apps/web/vitest.config.ts` now sets `testTimeout: 15_000`. The 5s default made a handful of
DOM-heavy tests fail intermittently only when the whole suite ran in parallel (measured 3-6s under
load, 0.1-2.4s in isolation); three consecutive full runs pass with the larger budget.

## Notes for the next person

- Trip labels are now `Draft` and `Needs review` (`Needs review` = unresolved conflicts or an
  overrun). Nothing can produce `Confirmed` any more, so the sidebar no longer claims it.
- If a decision surface is ever wanted back, the thing to build first is the action that applies a
  decision. The removed code is in git history at `8d2b5b0` and the commits leading to this branch.
- `docs/api.md`, `docs/architecture.md` and `docs/team-workflow.md` were updated by the same change.
