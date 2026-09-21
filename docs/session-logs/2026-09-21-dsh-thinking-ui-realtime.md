---
date: 2026-09-21
author: DeepSeek Harness agent
branch: fix/ui-interaction
pr: none
area: apps/web, packages/shared, packages/orchestrator, packages/agents, docs
contract-impact: packages/shared
---

# Make the thinking transcript realtime, and stop asking for the stay

## What changed

- `packages/shared/src/chat.ts` — `agent_reasoning`, `agent_started.objective`, `tool_started.args`,
  `tool_completed.resultRows`/`resultTruncated`, `agent_completed.outcome`/`choice`, and
  `needs_info.options`; `ToolResultRow`, `ToolChoice` and `AskQuestion` are new; `BOUNDED_RESULT_ROWS`
  caps a published result at 20 rows.
- `packages/agents/src/reasoning.ts` (new) — streams a chat model's `reasoning_content`. LangChain's
  OpenAI adapter carries the field on each chunk's `additional_kwargs` but drops it from the
  assembled message, so streaming is the only way to read it. `bindTools` and friends are re-wrapped:
  the model LangChain calls is the bound one.
- `packages/agents/src/models.ts` — `createRoutedChatModel(task, { thinking })`; the supervisor and
  coordinator run with thinking on, structured-output specialists stay off because DeepSeek rejects a
  forced `tool_choice` in thinking mode.
- `packages/orchestrator/src/reasoning-sink.ts` (new), `progress-tools.ts`, `supervisor.ts`,
  `workflow.ts`, `chat.ts` — paced reasoning events, per-tool result rows, round objectives and
  outcomes, the stay `choice`, and an `ask_the_traveller` tool.
- `packages/orchestrator/src/hitl.ts` + `packages/shared/src/plan.ts` — a stay the specialist already
  compared arrives `approved` and `decidedBy: "agent"`; it becomes the traveller's on change.
- `apps/web` — `ThinkingProcess.tsx` rebuilt as disclosure rows (count line, expand/collapse all,
  reasoning rows, tool rows that open to their options, round headings, status dot, one live region);
  new `TodoPanel`, `QuestionCard`, `StayDecision`; `CheckpointCards` no longer asks for the stay.

## Why

The surface imitated DSH's vocabulary without its behaviour: a checkmark box where a chevron belongs,
a round number with no explanation, tool rows that could not be opened, and a "Choose your stay" card
that asked every turn for a decision the accommodation specialist had already made. The reasoning and
the tool results were never on the wire at all, so no UI change could have shown them. `docs/design/
dsh-thinking-ui.md` now records what was ported and which divergences are deliberate.

## Validation

- `pnpm typecheck` — 6/6 tasks; `pnpm lint` — no warnings or errors; `pnpm test` — 505 passed across
  48 files (shared 29, services 4, tools 82, agents 95, orchestrator 73, web 222).
- New: `packages/orchestrator/tests/reasoning-sink.test.ts` pins delta pacing;
  `apps/web/tests/components/chat/ThinkingSurface.test.tsx` pins the fold, the count line, the global
  expand/collapse, a tool row's own options, a reasoning block and the stay choice.
- `apps/web` production build — compiled successfully, lint and types clean.
- Live check against the provider through `POST /api/chat`: one three-day Sydney request streamed
  19 reasoning events (2,819 characters), 15 tool results with their own rows — including
  `Search stays: 20 stay options` with 20 rows — and one stay choice with 19 alternatives.
- Browser check through the new `/debug/thinking` fixture page at 1400/900/360 px: no console errors,
  no horizontally overflowing element, and three real layout bugs found and fixed there — a
  disclosing tool row collapsed to a 22px column, the subagent row's chevron wrapped onto a second
  line, and `forms.css` dressed every transcript row as a secondary button.

## Notes for the next person

- Reading reasoning needs `DEEPSEEK_MODEL` to support thinking mode. A provider that ignores the
  flag produces no `agent_reasoning` events and the rows simply do not appear.
- The specialists still do not think. Turning thinking on for a structured-output model needs a
  different structured-output path first, because DeepSeek refuses a forced tool call in thinking
  mode.
- `apps/web/app/styles/forms.css` styles every button not on its exclusion list. A new button inside
  the transcript has to be added to that list, or it arrives with a border, a surface and a padding
  that shift its grid columns.
- `/debug/thinking` (development only) renders the transcript against a recorded frame sequence
  without a provider call; use it before touching a row's layout.
- `docs/workspace-ui.md` and `docs/design/dsh-thinking-ui.md` describe the new behaviour.
