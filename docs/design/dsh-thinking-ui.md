# DSH thinking UI reference

This document records how DeepSeek Harness (DSH, the `deepseek-harness` repository) renders an agent
turn — the running "Deep diving" line, the Think row, tool rows, and subagent rows — and how this
project's chat surface (`apps/web/components/chat/ThinkingProcess.tsx`) compares to it.

It exists because `ThinkingProcess.tsx` already borrows DSH's vocabulary (Think, Subagent, "Deep
diving", per-agent rows) without a written record of the behaviour it is imitating. Code references
to DSH are paths in that repository at the time of writing; code references to this project are
current paths in this repository.

The document has two jobs: describe DSH precisely enough to copy the timing and structure, and say
which parts of this project already match, which diverge, and what to change.

## 1. How DSH renders a turn

### 1.1 Pipeline

DSH never keeps a second copy of view state. Three layers carry a turn from the session log to the
screen:

```text
Session log (durable events) + assistant/live-chunk (client-only transient events)
        |  Session Controller keeps one contiguous window
        v
ConversationNodeAssembler - each package registers a ConversationNodeDefinition:
        match(event) -> start/update folds State -> buildViewNode() emits a target node
        v
Chat Node -> keyed renderer ('conversation.chat.node' dispatches by node kind)
        v
AssistantMarkdown / ReasoningRow / ToolCallTree / TurnProcessNodeView
```

Two properties matter when copying the behaviour:

- **Publication cadence is declared, not inferred.** Every definition returns `immediate`,
  `animation-frame`, or `none` per match (`packages/client/ui-chat/src/client/conversation-nodes/
turn-process.ts:240-246`). Visible text, reasoning, and tool-argument deltas are
  `animation-frame`; `usage` and `finish` chunks are `none`; tool calls, step/turn boundaries, and
  settled messages are `immediate`.
- **The high-frequency throttle is three animation frames, not one.** `BoundConversation.publish`
  chains three nested `requestAnimationFrame` calls and coalesces any further `animation-frame`
  publication into the pending chain; one `immediate` publication cancels the chain and flushes
  synchronously (`packages/client/ui-conversation/src/client/conversation/assembly.ts:130-158`).
  The rank table is `none < animation-frame < immediate` (`assembler.ts:54-58`).

One trap worth recording: DSH's own `packages/client/AGENTS.md` says streaming chunks use
`Notifier.markFrameDirty()`, but no production code calls that method. Live chunks go through
`markDirty()`, and the per-frame gate is the three-frame chain above.

### 1.2 The running line: "Deep diving"

While a turn is running, DSH shows exactly one line of text for the whole turn — not one per step,
and not one per agent. The label lives in `TurnProcessNodeView.tsx`
(`packages/client/ui-chat/src/client/chat/TurnProcessNodeView.tsx:13-58`): it is the same
process-fold button that, once the turn settles, folds into the `N tool calls · M messages ·
K subagents` summary (§1.4) — before settling, that button's label is the running text instead.

| Property       | Value                                                                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text           | `chat.deepDiving` — `Deep diving...` / `深度求索中` (`ui-chat/src/client/locale.ts:226`, `:68`); `message.turnProcess.deepDivingFor` once a duration exists                                                             |
| Motion         | **none.** `TurnProcessNodeView.module.css` gives the label a plain `color: var(--dsw-alias-label-tertiary)` with only a 100ms hover transition to `label-primary` — no shimmer, no gradient, no animation while running |
| Colours        | the ordinary tertiary label colour, same as any idle label — not brand blue                                                                                                                                             |
| Clock          | shown as soon as `turn.start` exists (`Math.max(1000, (turn.end?.time ?? now) - turn.start.time)`), not hidden for any interval; ticks at 1 Hz (`LIVE_RUN_CLOCK_INTERVAL_MS`, `message-chrome.ts:13`)                   |
| Anchor         | the turn's `start` time, so a mid-turn reload keeps the true elapsed value                                                                                                                                              |
| Accessibility  | a visually-hidden sibling `role="status" aria-live="polite" aria-atomic="true"` span carries the announcement text; the visible button itself is not the live region                                                    |
| Reduced motion | not applicable — there is no motion to reduce                                                                                                                                                                           |

`ChatView.tsx` (311 lines) and `ChatView.module.css` (168 lines) contain no "Deep diving" rendering
and no gradient or shimmer rule anywhere in either file. `TurnProcessNodeView.module.css`'s full git
history, from its creation (`8b09a0be52`, "fold turn process before final answer") through current
master (`c36a83ff6b`), carries no shimmer, gradient, or blue colour at any point either.

What DSH does have, and what §2 below borrows instead: every _other_ running-row label in DSH — a
process-group header while it is live (`ui-chat/src/client/chat/ChatGroupSeat.tsx:129`), a running
tool row's summary (`ui-tool/src/client/tool/components/ToolRow.tsx:213,223,227`), and the shared
disclosure-row title (`ui-primitives/src/DisclosureRow.tsx:103`) — wraps its text in `TextShimmer`
(`ui-primitives/src/TextShimmer.tsx` + `.module.css`): a `currentColor`-based gradient-text sweep,
`background-size: 250% 100%`, `background-clip: text`, `1.5s cubic-bezier(0.33, 0, 0.67, 1) infinite`,
keyframe `66.6667%, 100% { background-position: 0% center }`, spread scaled by `children.length * 8`px
via `--dsh-text-shimmer-spread`, and a reduced-motion fallback that drops the gradient
(`background-image: none; -webkit-text-fill-color: currentColor; animation: none`) rather than just
freezing it. It is always `currentColor` — never a blue ramp; the label keeps whatever text colour it
already has (`label-secondary` in `ChatGroupSeat`, tertiary in a running tool row).

The "one line per turn" rule is the part of this section most worth copying: it is what keeps a long
multi-specialist run from looking like a flickering dashboard. The clock behaviour above (shown
immediately, ticking at 1 Hz) is also worth copying as described. This project's own 15-second clock
delay (`CLOCK_DELAY_MS`, `thinking-model.ts:60`) is a local addition, not a DSH behaviour; see §2.

### 1.3 The Think row

A reasoning block renders as a collapsed disclosure, not as body text
(`packages/client/ui-chat/src/client/chat/ReasoningRow.tsx:28-63`):

- **Collapsed summary follows the phase.** While running it shows the _last_ line of the reasoning
  text (what the model is doing now); once settled it shows the _first_ line (what it concluded).
  Double-asterisk markers are stripped from the summary only.
- **Expanding shows the complete text**, `white-space: pre-wrap`, indented under the title, in the
  secondary type tier and the tertiary label colour.
- **The collapsed box is height-locked** (`contain: size layout; height: 24px`), so streaming text
  cannot reflow the transcript on every chunk.
- **Running is a sweep, not a spinner**: a 300px gradient band travels `left: -300px -> 100%` over
  `2.6s ease-out infinite`, with a 90% end hold. The same recipe is reused by the tool row, the bash
  row, the command row, and the skill row.
- A visually hidden `Running` label carries the state for assistive technology, because the sweep is
  colour-only.

### 1.4 The process fold

Once a turn has a final answer, DSH folds every process row behind one summary button
(`ui-chat/src/client/chat/TurnProcessNodeView.tsx:13-58`):

```text
N tool calls · M messages · K subagents
```

If there is nothing to count it falls back to `Thought for a while`. The counts are accumulated in
the definition, not derived by scanning at render time, and subagent delegations are partitioned out
of the tool-call count (`conversation-nodes/turn-process.ts:170-206`):

```ts
if (event.type === "tool/call") {
  const subagent = isSubagentDelegationTool(event.data.name);
  current = {
    ...current,
    toolCallCount: current.toolCallCount + (subagent ? 0 : 1),
    subagentCount: current.subagentCount + (subagent ? 1 : 0),
  };
}
```

Behavioural details that carry the feel:

- **Collapsed is the default.** The open state is a store entry keyed by
  `(turn, answerStep)`; no entry means collapsed, and regenerating an answer invalidates the entry.
- **Collapsing is not unmounting.** Hidden process rows stay in the DOM with `hidden="until-found"`,
  so browser find still matches them, and a `beforematch` listener expands the turn when it does
  (`ui-chat/src/client/chat/searchable-hidden.ts:17-29`).
- **The answer hugs the fold.** The transcript column gap drops from 16px to 8px between a closed
  fold and its answer.
- **The chevron rotates**, `-90deg -> 0deg`, `100ms ease` — it does not swap glyphs.
- A settings row can disable the whole fold (Normal vs Compact transcript, Compact default), which
  falls the process rows back to a flat list.

### 1.5 Tool rows

One tool call is one 24px disclosure row: leading glyph, title, a 2x2 separator dot, then a summary
that fills and ellipsizes (`packages/client/ui-tool/src/client/tool/components/ToolRow.module.css`).
Two orthogonal facts drive the row:

- **Variant** — what kind of work it is: `search | read | bash | write | edit | code | others`,
  looked up from the wire tool name.
- **State** — how it is going: `running | ok | error | stopped`. There is no `pending` and no
  `cancelled`.

| State     | Leading visual             | Motion                              | Hidden status text |
| --------- | -------------------------- | ----------------------------------- | ------------------ |
| `running` | the variant's own icon     | row sweep, `2.6s ease-out infinite` | `Running`          |
| `ok`      | the variant's own icon     | none                                | —                  |
| `error`   | `StateDot state="error"`   | none                                | `Failed`           |
| `stopped` | `StateDot state="warning"` | none                                | `Stopped`          |

The rule behind the table: **the icon says what it is; the dot says how it went.** A running row
keeps its tool icon. An unknown tool falls back to a generic row (sparkle icon, `Tool call` title,
`<name> · <first argument>` summary) — never to a blank row.

Expanding shows one structured body chosen by kind (terminal, diff, read, search, web, image,
question) or an IN/OUT card with each side capped at 150px and independently scrollable, with sticky
gutter labels. Chat-level read/diff/search cards cap at 8 lines. Failures _replace_ the summary with
the first line of the error rather than appending to it.

Nested calls indent under the parent with one repeated rule
(`ToolCallTree.module.css`): `margin-left: 22px; padding-left: 8px; border-left: 0.5px solid
var(--dsw-alias-border-l2)`. Depth is unbounded and adds no new styling.

### 1.6 Subagents

- The delegation tools are `subagent` and `subagent_*`; control tools (`send_message`,
  `interrupt_agent`, `list_agents`) deliberately do not count as delegations
  (`ui-chat/src/client/contract/turn-process.ts:53-61`).
- **There is no dedicated subagent card.** A delegation renders through the generic tool row; its
  distinct identity is the `N subagents` count in the process fold plus the child session.
- **Opening a child switches the whole surface**, it does not nest a transcript. The header
  breadcrumb keeps `parent / child` visible, and the sidebar hides subagent conversations entirely
  (`ui-workspace/src/client/tree.ts:146`).
- A settled background child comes back as a durable, attributed message (`source.kind:
'subagent-settled'`) rendered as a collapsed "Context injection" row — the child's own words stay
  distinct from the runtime's account of it.
- Running state is an 8-cell pixel chase at 1 Hz, and a live duration ticking once per second. The
  timer runs only while the catalog is open _and_ something is running; settled rows freeze at the
  last recorded interval cut rather than following the clock.

### 1.7 Icons and motion

`StateDot` is the shared status mark (`ui-primitives/src/StateDot.tsx`):

| State     | Colour semantics                                                                        | Drawing                                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `done`    | success                                                                                 | solid: 10% halo layer plus a 60%-scale core                                                                                                                                         |
| `warning` | warn                                                                                    | same                                                                                                                                                                                |
| `error`   | error                                                                                   | same                                                                                                                                                                                |
| `idle`    | tertiary label                                                                          | same                                                                                                                                                                                |
| `ongoing` | running blue — the only state colour with no alias token, pinned to the static 450 step | eight 2x2 cells on a 10x10 grid, discrete brightness steps `1 -> 0.6 -> 0.35 -> 0.15` at 0/12.5/25/37.5%, `1s infinite`, each cell offset by `-125ms` so the chase starts mid-cycle |

Motion inventory for the conversation surface:

| Effect                 | Timing                                                         | Where                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row sweep              | `2.6s ease-out infinite`, 300px band, 90% hold                 | thinking, tool, bash, command, skill rows                                                                                                                             |
| Text shimmer           | `1.5s cubic-bezier(0.33, 0, 0.67, 1) infinite`, `currentColor` | running process-group headers, tool-row summaries, disclosure-row titles (`TextShimmer`) — **not** the per-turn "Deep diving" line itself, which has no motion (§1.2) |
| Retry shimmer          | `1.6s ease-in-out infinite`                                    | model retry row                                                                                                                                                       |
| Status chase           | `1s infinite`, stepped                                         | `StateDot ongoing`                                                                                                                                                    |
| Icon/chevron crossfade | `100ms ease`                                                   | disclosure rows                                                                                                                                                       |
| Disclosure rotation    | `100ms ease`                                                   | process fold chevron                                                                                                                                                  |
| Catalog chevron        | `120ms ease`                                                   | subagent tree                                                                                                                                                         |
| Rail width/colour      | `140ms ease`                                                   | turn navigator                                                                                                                                                        |
| Rail position          | `220ms cubic-bezier(0.2, 0.8, 0.2, 1)`                         | turn navigator                                                                                                                                                        |

Two deliberate absences are worth knowing, because both are easy to add by reflex:

- **No spinner in the agent surface.** `IconLoadingOutline16` exists but is used only for document
  loading. Running is the sweep, the chase, or the text shimmer.
- **No streaming cursor.** There is no typing caret or blinking block anywhere in the client; the
  only `caret-color` is the composer's own. The terminal renderer deliberately does not implement
  ANSI blink.

Reduced-motion coverage in DSH is incomplete: the thinking row, the running line, the command row,
the retry row, and the skill row honour `prefers-reduced-motion`, but the tool-row sweep, `StateDot`,
the subagent chevrons, the todo ring, and the composer pending dot do not. Treat the gaps as defects
to fix rather than behaviour to copy.

## 2. What this project does today

The chat surface is `apps/web/components/chat/ThinkingProcess.tsx`, rendered by
`apps/web/components/chat/ChatPanel.tsx` inside a `section.agent-activity` labelled "Thinking
process". `apps/web/components/chat/thinking-model.ts` derives the tree from `activity`
(`AgentProgressEvent[]`) with no React in it; `Disclosure.tsx` is the one DSH-ported disclosure
chrome every row in the tree uses; `ThinkingRows.tsx` renders the reasoning, subagent and tool rows
on top of it. Its styles are `apps/web/app/styles/thinking.css`; a question the coordinator can ask
is either the assistant's own prose message or, for a structured ask, `QuestionComposer.tsx` taking
the composer's seat (`apps/web/app/styles/question.css`); the plain composer is
`apps/web/components/chat/Composer.tsx`. Messages themselves render through `MessageItem.tsx`
(`apps/web/app/styles/messages.css`). Design tokens live in `apps/web/app/styles/tokens.css`, and
progress frames are the `AgentProgressEvent` discriminated union in `packages/shared/src/chat.ts`.

The surface mirrors DSH row for row:

| DSH concept                                                                                        | This project                              | Location                                                   |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| `DisclosureRow`: leading icon crossfades to a chevron, no trailing chevron                         | `Disclosure`                              | `Disclosure.tsx`                                           |
| Per-turn process entry with a count line, collapsed by default                                     | `ThinkRow`                                | `ThinkingProcess.tsx`                                      |
| Reasoning block as its own disclosure row, one per model call                                      | `ReasoningRow`                            | `ThinkingRows.tsx`, `thinking-model.ts` (`mergeReasoning`) |
| Subagent rows nested under Think, one per (round, agent)                                           | `SubagentRow`                             | `ThinkingRows.tsx`, `thinking-model.ts`                    |
| Per-tool rows with running/completed/failed states, nested under their subagent                    | `ToolRow`                                 | `ThinkingRows.tsx`                                         |
| Expanding a tool shows the result's own rows, each with a category glyph                           | `ToolRow` body, `ResultKindIcon`          | `ThinkingRows.tsx`, `flow-icons.tsx`                       |
| One "Deep diving" line per turn, with a 15s clock                                                  | `RunningLine`                             | `ThinkingRows.tsx`                                         |
| State dot with a stepped chase                                                                     | `StatusDot`                               | `ThinkingRows.tsx`                                         |
| The decision an agent made, with its alternatives                                                  | `ChoiceBlock`                             | `ThinkingRows.tsx`                                         |
| Round boundary explained before the work it caused                                                 | `RoundHeading`                            | `ThinkingRows.tsx`                                         |
| DSH's 14px icon set (Think, chevron, search, globe, subagent, sparkle, check) plus category glyphs | —                                         | `apps/web/components/ui/flow-icons.tsx`                    |
| The composer card                                                                                  | `Composer`                                | `Composer.tsx`, `composer.css`                             |
| The structured question card taking the composer's seat                                            | `QuestionComposer`                        | `QuestionComposer.tsx`, `question.css`                     |
| Full-width assistant reply, right-aligned user bubble, a clock under each message                  | `MessageItem`                             | `MessageItem.tsx`, `messages.css`, `message-chrome.ts`     |
| Reduced motion for every effect                                                                    | `prefers-reduced-motion` blocks           | `thinking.css`, `composer.css`                             |
| Textual state for assistive tech                                                                   | `statusLabels`, `aria-label` on every row | `thinking-model.ts`, `ThinkingRows.tsx`                    |

It is worth being explicit about what must not be undone: every row carries a text label for its
state, every expanded detail is a real `aria-expanded` button rather than a styled div, the running
line is the only live region in the transcript, every animation is reduced-motion aware, and every
row starts collapsed — opening one never opens its siblings.

## 3. Where it diverges

The table below was the gap list at the time of the first port. Every row has since been closed; the
"Fixed by" column names the change that closed it.

| #   | DSH                                              | This project before                                                                                                                  | Consequence                                                              | Fixed by                                            |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------- |
| 1   | One running line per turn                        | `processSummary` could return `Deep diving · <tool>` _and_ `.thinking-deep-dive` rendered a second "Deep diving" row whenever `busy` | Two live indicators describe the same turn                               | 4.1 — one `RunningLine`, one live region            |
| 2   | Status is a state dot that never fades           | Status was a text glyph (`· ✓ ! ■ ○`) animated by `thinking-pulse` opacity `0.35 <-> 1`                                              | Fade reads as "loading", not "in progress"; glyph set is ad hoc          | 4.2 — `StatusDot` with the stepped chase            |
| 3   | Process rows fold behind one summary with counts | `ThinkingProcess` rendered `ThinkRow` plus all five `SubagentRow`s unconditionally                                                   | After completion the transcript kept a permanent five-row block          | 4.3 — the process folds once the turn settles       |
| 4   | Fold line names three counts                     | Expanded Think row said only `x/5 subagents have reported back`                                                                      | No visible measure of tool-call or round volume                          | 4.3 — `N tool calls · M subagents · K rounds`       |
| 5   | One sweep recipe: 300px, 90% hold                | Two sweeps at 180px plus `thinking-pulse` on three different elements                                                                | The "running" language is not uniform                                    | 4.4 — one `thinking-sweep`, 300px, 90% hold         |
| 6   | SVG chevron rotating `-90deg -> 0deg`, 100ms     | Text `⌄` with `translateY(-2px)` -> `rotate(180deg) translateY(2px)`, 160ms                                                          | Rotating a text glyph shifts baseline and does not match the fold timing | 4.6 — `ChevronIcon`, 100ms rotation                 |
| 7   | Elapsed clock after 15s, anchored at turn start  | None                                                                                                                                 | A long run had no sense of duration                                      | 4.5 — the `RunningLine` clock                       |
| 8   | `role="status"` scoped to the running line       | `aria-live="polite"` on the whole `.thinking-process` container                                                                      | Every progress frame re-announced the entire process region              | 4.7 — the running line is the only live region      |
| 9   | Subcalls indent under the parent with a rail     | Tool rows sat in `.thinking-subagent__tools` with no connector                                                                       | Nesting was implied by position only                                     | 4.6 — the subcall rail                              |
| 10  | Four states, and error is distinct from warning  | Seven states, and `failed` and "needs attention" both used `--warn`                                                                  | A failure and a warning looked identical                                 | 4.2 — the dot, with a distinct text label per state |

Two smaller notes that are still true. `agentStatus` returns `unknown` and `interrupted`, which DSH
would render as `stopped`, and both keep their own text labels. And `docs/workspace-ui.md` described
the per-agent detail as "native, collapsed `<details>` controls" while `ThinkingProcess.tsx`
implements buttons with `aria-expanded`; that sentence now matches the code and links here.

### 3.1 Divergences that are deliberate, not debt

Five behaviours are intentional and should not be "fixed" toward DSH:

- **Each reply carries its own transcript.** While a turn runs, its rows render live at the foot of
  the chat from the request-scoped `activity`; when the turn ends, those frames are attached to the
  agent message that ended it (`Message.activity`) and the Think fold renders above that reply, so
  every answer sits under the thinking that produced it. The frames are stored with the
  conversation and dropped on load if they no longer match `AgentProgressEvent`; open/closed state
  is not stored, so there is still no fold store entry and no `hidden="until-found"`.
- **A tool's expanded body is the result's own rows, not a generic IN/OUT card.** This project's
  tools return domain data — stay candidates, places, route legs, flights — so the transcript
  publishes that data as bounded rows (`resultRows`, capped at `BOUNDED_RESULT_ROWS = 20`) instead
  of raw payloads in two 150px scroll boxes.
  A row whose provider returned the page behind it (`ToolResultRow.url` — Google Places'
  `websiteUri` for a place or a Places-estimated stay, SerpApi's own details link for a SerpApi
  stay) leads with that site's icon, fetched host-only and referrer-free from Google's public
  favicon service, and falls back to the category glyph when there is no page or the image fails.
  Nothing synthesises a URL. The call's arguments render as one wrapped line — `Sydney Airport →
The Rocks · 2026-11-10`, with any other argument as a `key value` chip — rather than a stacked
  definition list.
- **Rounds are explained or hidden.** A round is the revision loop: round 1 dispatches, and a later
  round exists only because conflict detection asked a specialist to fix something. When every event
  is round 1, no round label renders at all; when a round above 1 exists it is headed by the
  coordinator's own summary and list of constraints, so the number always answers "what happened in
  this round".
- **Thinking belongs to the model that decides.** The supervisor and the coordinator run with
  DeepSeek thinking on and publish `reasoning_content` deltas. Specialists ask for structured output
  through a forced tool call, which DeepSeek refuses while thinking ("Thinking mode does not support
  this tool_choice"), so their work is visible as tool calls plus their own decision
  (`agent_completed.choice`) rather than as private reasoning. That is why reasoning rows are owned
  by the `itinerary` row: it is the run's spine, and no pseudo-agent outside `AGENT_NAMES` is
  invented to carry them. One round can hold several episodes of thinking — the dispatch supervisor
  and each revision pass — so a reasoning block is identified by `(agent, round, episode)`; every
  delta of one episode carries the same `index` and the client merges them into one growing block
  (see 4.5a).
- **No model selector, permission chip or context meter in the composer.** This app has one model,
  one user and no token budget to show, so DSH's three chips would be inert. The composer keeps
  DSH's other control: the bottom-left attach control, which opens a file picker.
- **Attachments are chips inside the card, as DSH draws them.** Files picked, dropped on the card or
  pasted become chips above the draft: a thumbnail for an image, a file glyph for a text file, each
  with its name, size and a remove control. Preparation happens in the browser before anything is
  sent (`apps/web/lib/chat/attachments.ts`) — an image is redrawn at 1024px and re-encoded, keeping
  PNG while it has transparency and the payload limit allows it, and a text file is truncated at the
  contract's byte limit with a marker saying so. A refusal is an inline line under the chips, not a
  toast that disappears before it is read.

### 3.2 Asking the traveller

- **The plan decides what it can decide.** The accommodation specialist already compares every
  eligible candidate and its proposal names one. The transcript reports that as
  `agent_completed.choice` — the selected stay, the specialist's own rationale, and the alternatives
  it compared — instead of a "Choose your stay" card waiting on the traveller every turn. Only the
  coordinator can ask the traveller anything: specialists run inside the orchestration graph and
  cannot end a turn.
- **A genuine ambiguity gets a structured question.** The coordinator has an `ask_user_question` tool
  (`packages/orchestrator/src/chat.ts`, mirroring DSH's tool of the same name): 1–4 questions, each
  with a stable id, optional header/detail, and up to 4 options (`label`, optional `description`).
  Calling it ends the turn — the prompt tells the coordinator to call no further tools and to say at
  most one short sentence afterwards, since the question card already shows the question. A
  recommended option is sent first with `" (Recommended)"` appended to its label, and each option
  carries a one-sentence tradeoff. The frame is `ChatAskUser` (`packages/shared/src/chat.ts`): `type:
"ask_user"`, the capped `questions`, `known` (the brief understood so far), the client's `plan`
  returned unchanged when there was one, and any `reply` prose. It is signalled like `needs_info`: an
  `AskUserError` thrown from `runConversationAgent`, caught in `apps/web/app/api/chat/route.ts` and
  sent as the turn's final frame; `apps/web/lib/workspace/workspace.ts` re-throws its own
  `AskUserError` from `readPlanStream`.
- **A fact with no useful choices still gets one plain sentence.** A missing destination, budget or
  date range has no menu of options worth offering, so the coordinator still asks for it inside its
  reply, unchanged — the `needs_info` path (`ChatNeedsInfo`) carries no option list and never will.
- **The answer becomes the next turn.** `QuestionComposer.tsx` takes the composer's seat while a
  `PendingAsk` (`apps/web/lib/workspace/ask-user.ts`) is open. Submitting calls `formatAskAnswers` to
  turn the answers into one line per question (`Header: choice, choice`, or `"no preference"` when
  skipped) and sends it as the traveller's next chat message together with `known` — the same request
  shape a typed follow-up already used, so nothing downstream needed to learn a new answer format.
  Closing the card dismisses it and returns the plain composer; the question text stays visible in
  the assistant's own message either way. See
  [`2026-09-23-ask-user-question`](../../.agents/notes/implemented/feature/2026-09-23-ask-user-question.md)
  for why this supersedes only the question half of the note that removed `ask_the_traveller`.
- **Still no decisions anywhere, including the Trip drawer.** `HitlCheckpoint`, `TripPlan.hitl`,
  `checkpointsFor`, `applyHitl`, `/api/hitl`, `CheckpointCards` and the client `Decision` path stay
  removed. There is no "apply the traveller's decision" feature for a plan choice — the ask-user
  question is about _planning input_ (pace, food preferences, an ambiguous date), never about
  approving what a specialist already chose. A traveller who wants a plan changed says so in chat or
  edits the trip; nothing waits for a confirmation they cannot give.

## 4. What was ported

Every step below landed. Each names the files that now carry it, and the order is the order they
were done in — each one was independent and could have landed alone.

Run `pnpm typecheck && pnpm lint && pnpm test` after each, and verify the chat surface in a browser
for the visual steps.

### 4.1 One live indicator per turn

`RunningLine` (`ThinkingRows.tsx`) is the single running signal: rendered once under the Think row,
only while `busy`, carrying `Deep diving`, the ellipsis animation, and
`role="status" aria-live="polite"`. Nothing else in the transcript is a live region, so a progress
frame announces one line instead of the whole region. When `busy`, the Think row's own summary
describes _what_ is happening (`Working with Stay`, `Waiting for 3 subagents`); it never repeats
"Deep diving".

### 4.2 Status is a state dot

`StatusDot` renders an 8px dot with a 10%-opacity halo layer and a 60%-scale core, coloured from
the existing tokens (`--accent` running, `--ok` completed, `--warn` failed, `--text-mut` queued).
The running state uses the stepped chase — `thinking-chase` holds 1 -> 0.6 -> 0.35 -> 0.15 at
0/12.5/25/37.5% — not a fade, because a fade reads as loading. The dot is `aria-hidden`; every row
keeps its existing text label for assistive technology, which is also what separates a failure from
a warning.

### 4.3 Every row starts collapsed; there is no expand-all

The whole tree — the Think row, every subagent row, every reasoning row, every tool row — starts
collapsed, busy or settled alike, and stays that way until the reader opens it. There is no
expand-all/collapse-all control: `useDisclosure`'s `generation`/`allExpanded` machinery is gone,
replaced by a plain `Set<string>` of open row ids in `ThinkingProcess.tsx`; toggling a row's id in or
out of the set opens or closes only that row. The Think row's own collapsed summary is the count
line, `N tool calls · M subagents · K rounds` (`countActivity`/`countLine` in `thinking-model.ts`),
with zero parts omitted; while busy it is `turnSummary`'s live text instead (4.5a, below).

Unlike DSH there is no durability requirement for the open set: the transcript is rebuilt from
`activity` on every request, so it lives in component state and resets with a new turn.

### 4.4 One sweep

`thinking-sweep` is the only sweep: a 300px band travelling `left: -300px -> 100%` over
`2.6s ease-out infinite` with a 90% end hold, reused by the running line and every running row.
`thinking-pulse` and the second sweep keyframe are gone, and the `prefers-reduced-motion` blocks
cover every animation in the surface.

### 4.5 Elapsed clock on the running line

`RunningLine` records the first frame of a run and hides the clock for the first 15 seconds
(`CLOCK_DELAY_MS`, `thinking-model.ts:60`), then ticks at 1 Hz in `tabular-nums`; `busy` going false
stops the interval. This is this project's own threshold, not a borrowed one — DSH's own running
line (`TurnProcessNodeView.tsx`, §1.2) shows its clock immediately, with no delay. Fifteen seconds
stays a reasonable default here regardless: short runs should not grow a clock.

### 4.5a Reasoning is one block per model call, and the tree nests to match DSH

The reasoning sink used to number every 160-character flush of one model call as its own `index`, so
a long thought arrived as several separate Think rows, each showing its own first line — a column of
mid-sentence fragments. `packages/orchestrator/src/reasoning-sink.ts` now gives every flush of one
sink the same `REASONING_BLOCK_INDEX` (0); the sink still paces the wire, but a chain's deltas are
all one block. `mergeReasoning` in `thinking-model.ts` concatenates deltas by `(agent, round,
episode)` client-side, which also merges older recorded frames that numbered each flush apart.

A merged block's collapsed summary follows the phase, matching DSH 1.3: while streaming it shows the
block's _last_ line, right-anchored (`RowSummary`'s `followEnd`, DSH's `[data-follow-end]`) so the
newest words are what the reader sees advance; once settled it shows the _first_ line. The Think
row's own live summary (`turnSummary`) follows the same rule at the turn level: while the newest
event in the turn is a streaming reasoning delta, the row shows that block's latest line; once any
agent acts after it, the row falls back to the live tool/subagent line.

The tree itself is `Think` (the turn) → `Subagent · <name>` rows, one per `(round, agent)` → that
subagent's own reasoning and tool rows, in arrival order → a tool's result rows. Every level uses one
DSH rail rule (`margin-left: 22px; padding-left: 8px; border-left: 0.5px solid var(--border)`), so a
subagent's rail aligns under Think's leading icon and a tool's rail aligns under its subagent's.

### 4.5b The running label's shimmer

The label text itself — "Deep diving" — carries DSH's `TextShimmer` recipe
(`ui-primitives/src/TextShimmer.tsx`/`.module.css`, §1.2), applied via `[data-text-shimmer]` in
`thinking.css`: a `currentColor` gradient sweep, `background-size: 250% 100%`,
`1.5s cubic-bezier(0.33, 0, 0.67, 1) infinite`, spread scaled by the label's own character count
(`--thinking-text-shimmer-spread`), and a reduced-motion fallback that drops the gradient rather than
freezing it. This is a deliberate substitution, not a literal port of DSH's per-turn "Deep diving"
line — that line has no motion at all in DSH (§1.2). What this project borrows instead is the
running-row shimmer DSH uses everywhere _else_ a row is live (`ChatGroupSeat`, `ToolRow`,
`DisclosureRow`), so the transcript's one running line still reads as "in progress" the way DSH's own
tool and reasoning rows do. The colour stays `currentColor` at the existing tertiary label tone — no
blue ramp was introduced. There is no animated ellipsis next to the label: DSH shows no such
animation next to a running label, only the shimmer or the sweep.

### 4.6 Disclosure chrome: no trailing chevron, leading icon crossfades

`Disclosure.tsx` ports DSH's `DisclosureRow` directly instead of a bespoke `ChevronIcon` rotation:
a 24px row, a 16px leading box holding a 14px glyph, 6px gap, a 13px title. There is no trailing
chevron anywhere in the tree. On hover, or while the row is open, the leading icon crossfades
(100ms) to a down chevron (`FlowChevronDownIcon`, ported from DSH's `IconChevronDownOutline14`); a
row with nothing to disclose renders its icon plain, with no hover state and no `role="button"`.
Nested rows use the rail described in 4.5a rather than the older `padding-left` plus a 1px border.

### 4.7 Narrow the live region

Done in 4.1: `aria-live` is on the running line alone.

### 4.8 Realtime reasoning, tool results and decisions

The contract this needed is new in `packages/shared/src/chat.ts`:

| Event                                           | What it carries                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `agent_reasoning`                               | One paced slice of a model's private reasoning, keyed by `(agent, round, episode, index)`   |
| `agent_started.objective`                       | The bounded objective the supervisor handed that specialist                                 |
| `tool_started.args`                             | The arguments the call was made with                                                        |
| `tool_completed.resultRows` / `resultTruncated` | The result's own rows, bounded, plus a flag when the head is all that was published         |
| `ToolResultRow.url`                             | The page a provider genuinely returned for that row, so the row can lead with its site icon |
| `agent_completed.outcome` / `choice`            | What the round changed, and the option the specialist settled on                            |
| `needs_info.asked`                              | The question the agent posed, its context and its suggestions                               |

`packages/agents/src/reasoning.ts` turns `invoke` into a stream so `reasoning_content` can be read
at all: LangChain's OpenAI adapter puts the field on `additional_kwargs` of each chunk but drops it
from the assembled message, so there is no other way to read it. `bindTools`, `bind` and
`withStructuredOutput` are re-wrapped because the model LangChain actually calls is the bound one —
a proxy that replaces only `invoke` never sees a token. `packages/orchestrator/src/reasoning-sink.ts`
paces the deltas into transcript events, names the model call chain they belong to (the episode),
and flushes the tail at the end of the model call.

`packages/orchestrator/src/progress-tools.ts` is where a tool call becomes readable: every gateway
method now reports its arguments and a bounded, structured summary of its own result — stay
candidates with area, total, rating and cancellation; places with category and rating; route legs
with mode, duration and price; flights with carrier, price and stops. It still never publishes a
provider payload or a credential.

### 4.9 (removed) The todo panel

A `TodoPanel` dock modelled on DSH's `TodoPanel` used to sit above the composer, and it is gone.
It was built for a product that does not exist: its statuses came from the decision checkpoints
("confirm the plan", "review conflicts"), and when those were removed the panel could only report
work nothing was doing. The transcript already says what is happening — the Think row's count line
and the todo panel were two summaries of the same run, and the count line is the one that stays.

### 4.10 The composer is a card, not a form row

`apps/web/components/chat/Composer.tsx` with `apps/web/app/styles/composer.css` replaces the old
input-plus-two-buttons row. It follows DSH's `InputBar` shape: one capsule surface holds the text and
its controls, a 28px round control sits bottom-left, the primary action bottom-right, the draft grows
with its content and then scrolls inside the card, and the card carries the focus ring for the whole
control. The corner is DSH's literal 22px rather than this app's 14px panel radius, because the card
is an input capsule and 14px would flatten it into another panel.

Three of DSH's controls are deliberately absent: the model selector, the permission/access chip and
the context-window meter. This app has one model, one user and no token budget to show, so they would
be three inert chips. The bottom-left control is the attach control, and it opens a multi-file
picker.

Attachment chips sit above the draft inside the same card, aligned to the draft's own 14px column,
and the whole capsule is the drop target (`data-dragging` dashes its border). The chip itself is
`components/chat/AttachmentChip.tsx` and its look is shared with the sent message, so a file reads
the same before and after it leaves — DSH keeps two shapes (a bare 64px thumbnail for an image, a
240px card for a file), but this chat column is too narrow for an unlabelled square to identify a
pasted screenshot, so one card shape serves both and an image puts its thumbnail in the glyph's
slot. The remove control is a real button named after its file; the thumbnail carries an empty
`alt`, because the name is already beside it as text.

The card's fill is `--surface-2`, not `--surface`: DSH fills its composer with
`--dsw-specific-input-major`, which in its dark palette is `rgb(44, 44, 46)` — one elevation rung
above the page, a grey capsule rather than the page colour. This app's `--surface-2` is that same
rung and already means "a surface laid on the page" (white on light, grey on dark), so the two
themes move in opposite directions the way DSH's do. The attach circle then takes `--border` as its
fill with primary ink for the glyph, because a selector fill one rung below a grey card reads as
disabled.

The composer's two controls own their size — the 28px circle and the 34px send — and
`apps/web/app/styles/forms.css` is what has to know that: it puts a 36px `min-height` on every
button in the app, and its `button:not(...)` chains are more specific than a plain class, so a
composer rule cannot cancel it. Both controls are listed in those chains. The field itself draws no
focus ring, because `base.css` rings every focusable element and inside the card that would be a
second highlight nested in the card's own accent border.

Three behaviours are worth keeping:

- **Enter sends, Shift+Enter breaks the line, and an IME composition never submits.** The last one
  is what lets Chinese and Japanese be typed at all; `event.nativeEvent.isComposing` is the guard.
- **The primary action becomes Stop in place** — same 34px circle, warning colour, a square glyph —
  so stopping is never mistaken for sending.
- **The text surface is a `textarea`, not DSH's contenteditable.** DSH renders its attachment chips
  as decorator portals inside the editor; here they are ordinary DOM above the field, so a textarea
  still gives the three behaviours that matter (grow, keyboard, own scroll) with far less machinery
  — and the chips can be real list items with real buttons.
- **A paste that carries files attaches them.** An image on the clipboard is the common case and has
  no file name to pick; a paste with no files falls through to ordinary typing.

`chat.css` used to style `.chat__form`'s input and both buttons as a horizontal row; that block is
gone, and the form is now only the submit boundary around the card.

### 4.11 No calendar pop-up in the chat

The composer used to carry a calendar control and `ChatPanel` used to auto-open a date-picker dialog
when the assistant's message looked like a date question. A regex guessing at the assistant's intent
is not a good reason to open a modal, and it fought the conversation: a date question opened the
dialog _over_ the surface the traveller was meant to answer on. Both are gone. A date question is now
answered in the conversation, dates can be typed in the composer at any time, and the real calendar
picker still lives in the top bar's When editor, where the traveller asks for it.

### 4.12 Messages: full-width reply, a bubble for the traveller, a clock on both

`MessageItem.tsx` replaces the old bordered-box rendering for both speakers, after DSH's
`MessageItem`/`AssistantMarkdown`. The assistant's reply is full-width prose with no border,
background or visible speaker label (a screen-reader-only label still names the speaker), rendered
through `react-markdown` (`apps/web/lib/dev/thinking-fixtures.ts` and `Message.text` were already
Markdown-shaped; only the renderer changed) with links opened in a new tab, no referrer, no opener.
The traveller's own message stays a right-aligned bubble. Both carry a small clock underneath,
`formatMessageClock` in `apps/web/lib/workspace/message-chrome.ts` (ported from DSH's function of the
same name): the same calendar day as now renders `HH:mm`; any other day adds a short date. `Message.at`
(epoch ms) is optional, stamped when a message is appended, so a trip saved before this change still
loads and simply shows no clock.

The newest reply arrives with a word-by-word reveal, in the spirit of the streaming-text components
on shadcn/ui and Magic UI's `TextAnimate` (`blurIn`): each word fades up out of a 5px blur, 26ms
after the one before it, over 320ms. `RevealedText.tsx` does the split with a small rehype plugin on
the _rendered_ tree, so headings, lists, links and code survive and the whole reply is in the DOM
from the first frame -- only `opacity` and `filter` animate, so a screen reader, find-in-page and
copy/paste see everything immediately. The stagger compresses on a long reply so the last word still
lands inside a 700ms budget, and `prefers-reduced-motion: reduce` drops the reveal (and the row's own
fade) entirely. `ChatPanel` marks exactly one message with `animate`: the last one, when it is an
agent reply that arrived after the panel mounted. A transcript restored from storage after a reload
therefore never animates, and `RevealedText` latches the flag on mount so a re-render cannot replay
it. No motion library was added; this is CSS in `messages.css` plus per-word `animation-delay`.

### 4.13 Ask-question card

Covered in 3.2 and the [ask-user Agent Note](../../.agents/notes/implemented/feature/2026-09-23-ask-user-question.md);
listed here only so the "what was ported" list stays complete. `QuestionComposer.tsx` replicates DSH's
`QuestionFlow`: numbered options with a parsed "(Recommended)" badge and description, multi-select
checkboxes, an inline "Other" free-text row, an optionless question as a block textarea, and a
`‹ i / n ›` pager with Skip and Next/Submit. Single-select auto-advances on click; Enter continues,
Shift+Enter breaks the line, and an IME composition never advances — the same guard the composer
uses.

One deliberate deviation from DSH: the "Recommended" badge sits at the end of the option row
(`.question__badge { margin-left: auto }` in `question.css`), after the label and its description,
rather than between the label and the description as in DSH. This was a specific request at review,
so the tag never splits the label from its description when both wrap.

## 5. What not to copy

- **The three-frame publication gate and the node assembler.** They solve a problem this app does
  not have: DSH keeps a durable session log and rebuilds views by replay. Here, `activity` is a
  request-scoped array in the workspace controller.
- **`hidden="until-found"` folding.** It is the right answer for DSH's searchable transcript; this
  project has no in-page transcript search, so a simple conditional render is correct and simpler.
- **Subagent sessions, lineage breadcrumbs, and the catalog tree.** DSH's subagents are first-class
  sessions with their own logs. Here the five specialists are fixed, so a fold over five known names
  is the honest structure.
- **The token names and the dark/light alias pairs.** This project already has semantic tokens in
  `tokens.css`; borrow the _levels_ (tertiary/secondary label, success/warn/error state, a running
  accent) rather than the names.
- **`StateDot`'s eight-cell matrix.** The stepped chase is worth keeping; the 8-cell pixel geometry
  is a DSH brand detail at 10px. An 8px halo-and-core dot with the same keyframes is closer to this
  app's existing icon weight.
- **DSH's model, permission and context chips.** They are real controls there; here they would be
  three inert chips. The composer keeps the attach control and its attachment chips, and omits those
  three (see 3.1).
- **DSH's process-fold durability and `hidden="until-found"`.** DSH keeps a store entry keyed by
  `(turn, answerStep)` and folds a settled turn behind one summary that survives a reload. This
  project keeps each reply's frames with the message (see 3.1) but not its open state, so every row
  simply starts collapsed in component state; there is no fold-on-settle transition.

## 6. Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test` for every step.
- `apps/web/tests/components/chat/ThinkingSurface.test.tsx` covers the tree directly: a settled turn
  folds behind its count line with every row collapsed; the transcript starts collapsed while busy
  too, with one live region; opening Think reveals only its subagent rows, each independently
  toggleable; opening a tool, a reasoning block and a choice each opens one row at a time; streamed
  reasoning deltas merge into one row that follows the newest line; a result row's glyph comes from
  its `kind` or falls back to its tool; there is no trailing chevron and no expand-all control
  anywhere in the tree; and a row toggles from the keyboard.
- `apps/web/tests/components/chat/ChatPanel.test.tsx` covers the chat surface end to end: messages in
  conversation order with a stable label; subagents opened and closed one at a time; the count-line
  fold; round headings above round 1 only; the live thinking transcript and Stop action while busy;
  live tool rows settling on their result; a tool call's arguments, result rows and truncation note;
  a streamed reasoning block collapsed on its last line, expanded to the full text; the accommodation
  choice and its alternatives; and that no confirmation card or suggestion list renders (a structured
  ask still renders as `QuestionComposer`, covered separately — see below).
- `apps/web/tests/components/chat/MessageItem.test.tsx` covers the user bubble, the full-width
  borderless agent reply, both messages' clocks (today's `HH:mm`, another day's short date, and no
  clock without a timestamp), lightweight Markdown (lists, bold, no raw HTML) and links opening in a
  new tab without a referrer It also covers the reveal: words wrapped and
  staggered in order when `animate` is set, the stagger compressed inside the budget on a long reply,
  code left unsplit, the paragraph still readable as one run of text, no reveal markup without
  `animate`, and no replay when the prop changes or the component re-renders.
- `apps/web/tests/components/chat/QuestionComposer.test.tsx` covers the card itself: the header,
  numbered options with the Recommended badge and pager; single-select auto-advance and multi-select
  toggling; submitting labels, Other text and optionless text together; replacing a single-select
  choice with Other; skipping to "no preference"; returning to an unanswered question with feedback
  instead of submitting; Enter/Shift+Enter/IME; collapsing and dismissing; and parsing the
  " (Recommended)" suffix. `apps/web/tests/components/workspace/AskUser.test.tsx` covers the
  workspace wiring: the card seats in place of the composer and sends the answers with `known`; the
  close button dismisses it and restores the composer; and a pending question is dropped when the
  traveller starts a new chat.
- `packages/orchestrator/tests/reasoning-sink.test.ts` pins that every flush of one sink carries the
  same block index and that two episodes in one round stay apart; `chat.test.ts` pins
  `ask_user_question` — the questions and options it records, that blanks are dropped and both lists
  are capped, and that asking ends the turn as an `AskUserError` carrying the client's plan
  unchanged; `progress-tools.test.ts` pins the bounded result rows, their `kind` (place keyword
  matching, travel mode, stay/flight/weather fixed) and that a provider error never reaches the
  transcript. `packages/shared/tests/chat.test.ts` pins the `ChatAskUser` and `ToolResultRow.kind`
  schemas, including the question and option caps.
- The end-to-end shape was checked against the live provider before this change: a three-day Sydney
  request streamed 19 reasoning events and 15 tool results with their own rows (including `Search
stays: 20 stay options` with 20 rows) plus one stay choice with 19 alternatives; and an ambiguous
  "Sydney in March" request produced a plain one-sentence question from the coordinator. Re-verifying
  the merged-reasoning transcript and the `ask_user_question` card against the live provider needs
  `DEEPSEEK_API_KEY` and is tracked as a follow-up rather than claimed here.
- Browser checks: `/debug/thinking` was used to measure every transcript row, and `/debug/question`
  (development only, `apps/web/app/debug/question/page.tsx`) seats the question card against a fixed
  `PendingAsk` without a provider call. One trap both pages catch: `apps/web/app/styles/forms.css`
  styles every button not on its exclusion list as a secondary button, so a new control inside the
  transcript, the composer or the question card arrives with a border, a surface and a padding that
  shift its grid columns. `.thinking-line`, `.thinking-control`, `.thinking-choice__toggle`,
  `.composer__add`, `.composer__primary`, `.question__icon-button`, `.question__option` and
  `.question__button` are on that list.
- `/debug/thinking` (`apps/web/app/debug/thinking/page.tsx` with `apps/web/lib/dev/thinking-fixtures.ts`)
  renders the transcript against a recorded frame sequence in three modes — Settled, Mid-flight and
  Replay, which streams the mid-flight fixture one frame at a time — without a provider call. It is
  the fastest way to check a row's layout.

## 7. Sources

DSH, in the `deepseek-harness` repository:

| Topic                                                            | Path                                                                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Turn pipeline and publication cadence                            | `docs/subsystems/conversation.md`                                                                                                                |
| Running line                                                     | `packages/client/ui-chat/src/client/chat/ChatView.tsx:168-201`, `ChatView.module.css:80-137`                                                     |
| Think row                                                        | `packages/client/ui-chat/src/client/chat/ReasoningRow.tsx`, `ReasoningRow.module.css`                                                            |
| Process fold                                                     | `TurnProcessNodeView.tsx`, `conversation-nodes/turn-process.ts`, `stores.ts`, `searchable-hidden.ts`                                             |
| Tool rows                                                        | `packages/client/ui-tool/src/client/tool/components/ToolRow.tsx`, `ToolRow.module.css`, `models/tool-call-model.ts`, `ToolCallTree.tsx`          |
| Status dot                                                       | `packages/client/ui-primitives/src/StateDot.tsx`, `StateDot.module.css`                                                                          |
| Disclosure chrome                                                | `packages/client/ui-primitives/src/DisclosureRow.tsx`, `DisclosureRow.module.css`                                                                |
| Icons                                                            | `packages/client/ui-primitives/src/icons/index.tsx`                                                                                              |
| Subagents                                                        | `packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx`, `subagent-lineage.ts`, `SubagentReadOnlyComposer.tsx`                        |
| Todo dock above the composer (consulted, then removed — see 4.9) | `packages/client/ui-conversation/src/client/skeleton/TodoPanel.tsx`, `TodoPanel.module.css`                                                      |
| Asking the traveller                                             | `packages/client/ui-user-questions/src/client/QuestionComposer.tsx`, `contract/slots.ts`, `packages/interaction/user-questions/src/types.ts`     |
| The composer card                                                | `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`, `InputBar.module.css`                                                        |
| Streaming throttle                                               | `packages/client/ui-conversation/src/client/conversation/assembly.ts:130-158`, `packages/api/session-controller/src/client/sessions/notifier.ts` |

This project:

| Topic                          | Path                                                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thinking surface               | `apps/web/components/chat/ThinkingProcess.tsx`, `ThinkingRows.tsx`, `thinking-model.ts`                                                                                 |
| Disclosure chrome              | `apps/web/components/chat/Disclosure.tsx`                                                                                                                               |
| Icons                          | `apps/web/components/ui/flow-icons.tsx` (ported DSH glyphs and category glyphs), `icons.tsx` (unrelated app chrome)                                                     |
| Chat rendering                 | `apps/web/components/chat/ChatPanel.tsx`                                                                                                                                |
| Messages                       | `apps/web/components/chat/MessageItem.tsx`, `apps/web/components/chat/RevealedText.tsx`, `apps/web/lib/workspace/message-chrome.ts`, `apps/web/app/styles/messages.css` |
| Composer                       | `apps/web/components/chat/Composer.tsx`, `apps/web/app/styles/composer.css`                                                                                             |
| Ask-question card              | `apps/web/components/chat/QuestionComposer.tsx`, `apps/web/lib/workspace/ask-user.ts`, `apps/web/app/styles/question.css`                                               |
| Stay decision                  | `ChoiceBlock` in `apps/web/components/chat/ThinkingRows.tsx`                                                                                                            |
| Thinking styles                | `apps/web/app/styles/thinking.css`                                                                                                                                      |
| Design tokens                  | `apps/web/app/styles/tokens.css`                                                                                                                                        |
| Progress and ask-user contract | `packages/shared/src/chat.ts`                                                                                                                                           |
| Reasoning stream               | `packages/agents/src/reasoning.ts`, `packages/orchestrator/src/reasoning-sink.ts`                                                                                       |
| Thinking model routing         | `packages/agents/src/models.ts` (`RoutedModelOptions`)                                                                                                                  |
| Tool result detail and kind    | `packages/orchestrator/src/progress-tools.ts`                                                                                                                           |
| Ask-user tool                  | `packages/orchestrator/src/chat.ts` (`askUserQuestion`, `toQuestions`, `AskUserError`)                                                                                  |
| Round and choice events        | `packages/orchestrator/src/supervisor.ts`, `workflow.ts`, `chat.ts`                                                                                                     |
| Development fixture pages      | `apps/web/app/debug/thinking/page.tsx`, `apps/web/lib/dev/thinking-fixtures.ts`, `apps/web/app/debug/question/page.tsx`                                                 |
