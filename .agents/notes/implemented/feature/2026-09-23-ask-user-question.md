# Agent Note: Structured ask-user questions

Status: implemented
Owner: A (@Lilstanie)

## Problem

The coordinator could only ask the traveller a genuine ambiguity in one plain-text sentence inside
its reply, and the answer was whatever the traveller happened to type back — there was no way to
offer concrete choices, and no contract for the client to render anything but prose. That was a
deliberate simplification: [`2026-09-22-remove-hitl-decisions`](../simplification/2026-09-22-remove-hitl-decisions.md)
removed the earlier `ask_the_traveller` tool, `ChatQuestion` and `QuestionPrompt` card alongside the
unrelated HITL checkpoint apparatus, because neither had a downstream feature that acted on the
answer.

That note's HITL half still stands: there is still no "apply the traveller's decision" feature, and
this change does not touch `HitlCheckpoint`, `TripPlan.hitl` or the checkpoint UI. Only its question
half is superseded, for a reason that note called out as the bar to clear: the coordinator's plain-
prose question already existed and needed no reintroduction, but a form of structured choices was
rejected only because nothing consumed the answer. This change gives the answer a consumer — it
becomes the next turn's message, sent back through the same chat loop as any follow-up — so the
capability gap that justified leaving it out is closed.

## Decision

The coordinator gets one additional tool, `ask_user_question` (`packages/orchestrator/src/chat.ts`),
modelled on DeepSeek Harness's tool of the same name. Calling it ends the turn: the tool records up
to `ASK_USER_MAX_QUESTIONS` (4) questions, each with an id, prose, an optional header/detail, and up
to `ASK_USER_MAX_OPTIONS` (4) options (`label`, optional `description`); `toQuestions` drops blank
questions and blank option labels and de-duplicates ids. The prompt tells the coordinator to reach
for the tool only when 2–4 concrete choices would help, to put a recommended option first with
`" (Recommended)"` appended to its label, and to ask at most once per turn with no further tool calls
afterwards; a fact with no useful choices (a destination, a budget) still goes in the plain-sentence
`needs_info` path, unchanged.

`packages/shared/src/chat.ts` adds `AskUserQuestionItem`, `AskUserQuestionOption` and the response
frame `ChatAskUser = { type: "ask_user", questions, known, plan?, reply? }`, sent instead of a
completed plan — `known` is the brief understood so far and travels back with the traveller's
answer like any follow-up; `plan` is the client's own plan returned unchanged (`readPlanStream`
requires every completed frame to carry one when the request had one, so a question about an open
trip does not blank it). The orchestrator signals the frame the same way it signals `needs_info`: an
`AskUserError` thrown out of `runConversationAgent`, caught in `apps/web/app/api/chat/route.ts` and
sent as the turn's final frame; `apps/web/lib/workspace/workspace.ts` parses it in `readPlanStream`
and throws its own `AskUserError` for the caller.

The client renders the pending ask as `QuestionComposer.tsx`, a card that takes the composer's seat
(`PendingAsk` in `apps/web/lib/workspace/ask-user.ts`), styled and behaved after DSH's
`QuestionFlow`: numbered options with a parsed "Recommended" badge, multi-select checkboxes, an
inline "Other" free-text row, an optionless question as a plain textarea, and a pager for several
questions. Submitting calls `formatAskAnswers` to turn the answers into one line per question
(`Header: choice, choice` or `"no preference"` when skipped) and sends that text as the traveller's
next chat message together with `known` — the same shape a typed follow-up already used, so nothing
downstream needed to change to consume the answer. Closing the card dismisses it and returns the
plain composer; the question text stays visible in the assistant's own message either way.

Two related contract changes shipped in the same pull request because they touch the same files:

- **Reasoning block identity.** `agent_reasoning` deltas from one model call now all carry the same
  `index` (`REASONING_BLOCK_INDEX = 0` in `packages/orchestrator/src/reasoning-sink.ts`), so a client
  merges them into one growing block keyed by `(agent, round, episode)` instead of rendering each
  160-character flush as its own row. `episode` is still what tells two model-call chains in the same
  round apart.
- **Result-row icon kind.** `ToolResultRow.kind?: ToolResultKind` (`packages/shared/src/chat.ts`)
  names a result's category — place categories by keyword (`placeKind` in
  `packages/orchestrator/src/progress-tools.ts`), travel legs by mode (`travelKind`), stays and
  flights fixed, weather fixed — so the client can choose a glyph without parsing the label. It is
  optional so an older emitter's rows still validate.

## Alternatives considered

**Keep the plain-prose question and add nothing.** That was the status quo this note replaces; it
cannot offer a recommended default or bounded choices, and travellers answering in free text produced
briefs the coordinator had to re-parse. Rejected because the earlier removal's own stated reason
(nothing consumes the answer) no longer applies once the answer is wired back into the loop.

**Have the client interpret the coordinator's prose into choices.** Rejected: guessing structure out
of natural language is unreliable and duplicates work the model already does better when it is asked
for structure directly via a tool call.

**A separate `/api/ask` endpoint instead of a frame on the chat stream.** Rejected: the ask ends a
chat turn exactly like `needs_info` does, and reusing `readPlanStream`'s existing frame-then-throw
pattern needed no new endpoint, request shape or client wiring.

## Consequences

- The coordinator can end a turn with no plan and no plain question, only a pending ask; every
  caller of the chat stream must handle `ChatAskUser` alongside `ChatNeedsInfo` and the completed
  response (`apps/web/app/api/chat/route.ts`, `apps/web/lib/workspace/workspace.ts`).
- `packages/shared/src/chat.ts` is a shared contract; question and option counts are capped
  (`ASK_USER_MAX_QUESTIONS = 4`, `ASK_USER_MAX_OPTIONS = 4`) so the wire shape stays bounded no matter
  what the model sends.
- Only the coordinator can ask: specialists run inside the orchestration graph and cannot end a turn,
  so they still report a choice as `agent_completed.choice` (unchanged, see
  [`dsh-thinking-ui`](../../../../docs/design/dsh-thinking-ui.md) §3.2).
- `docs/design/dsh-thinking-ui.md` §3.2 and §5 and `docs/workspace-ui.md` no longer describe the
  question path as removed; they describe the card. `.agents/notes/implemented/simplification/2026-09-22-remove-hitl-decisions.md`
  is corrected in the same pull request so its Consequences section stops claiming the app asks
  nothing in a structured form, without touching its Decision.
- Offline/mock mode never calls the coordinator's model, so it never asks; the composer only ever
  swaps to the question card behind a live `DEEPSEEK_API_KEY` run or the `/debug/question` fixture.

## Sources

[2026-09-23 session log](../../../session-logs/2026-09-23-dsh-thinking-ui-and-ask-user.md)
