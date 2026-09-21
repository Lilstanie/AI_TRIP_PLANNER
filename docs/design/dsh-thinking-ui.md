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
and not one per agent (`packages/client/ui-chat/src/client/chat/ChatView.tsx:168-201`, rendered once
at `:805-807`). The comment on that render site states the intent: it rides first-token wait, tool
execution, and streaming, "so it never flickers per step".

| Property | Value |
| --- | --- |
| Text | `chat.deepDiving` — `Deep diving...` / `深度求索中...` (`ui-chat/src/client/locale.ts:135`, `:25`) |
| Motion | gradient text sweep, `1.8s linear infinite`, background 250% wide |
| Colours | brand blue 500 at 0/40/60/100%, blue 200 at the 50% highlight |
| Clock | hidden for the first 15 s, then `Ran`-style duration ticking at 1 Hz, `tabular-nums` |
| Anchor | the turn's `turn/start` time, so a mid-turn reload keeps the true elapsed value |
| Accessibility | `role="status" aria-live="polite"` on the line itself |
| Reduced motion | `animation: none`, gradient collapsed to `100% 100%`, text becomes solid |

The clock threshold and the "one line per turn" rule are the parts most worth copying: they are what
keep a long multi-specialist run from looking like a flickering dashboard.

### 1.3 The Think row

A reasoning block renders as a collapsed disclosure, not as body text
(`packages/client/ui-chat/src/client/chat/ReasoningRow.tsx:28-63`):

- **Collapsed summary follows the phase.** While running it shows the *last* line of the reasoning
  text (what the model is doing now); once settled it shows the *first* line (what it concluded).
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
if (event.type === 'tool/call') {
  const subagent = isSubagentDelegationTool(event.data.name)
  current = { ...current,
    toolCallCount: current.toolCallCount + (subagent ? 0 : 1),
    subagentCount: current.subagentCount + (subagent ? 1 : 0) }
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

| State | Leading visual | Motion | Hidden status text |
| --- | --- | --- | --- |
| `running` | the variant's own icon | row sweep, `2.6s ease-out infinite` | `Running` |
| `ok` | the variant's own icon | none | — |
| `error` | `StateDot state="error"` | none | `Failed` |
| `stopped` | `StateDot state="warning"` | none | `Stopped` |

The rule behind the table: **the icon says what it is; the dot says how it went.** A running row
keeps its tool icon. An unknown tool falls back to a generic row (sparkle icon, `Tool call` title,
`<name> · <first argument>` summary) — never to a blank row.

Expanding shows one structured body chosen by kind (terminal, diff, read, search, web, image,
question) or an IN/OUT card with each side capped at 150px and independently scrollable, with sticky
gutter labels. Chat-level read/diff/search cards cap at 8 lines. Failures *replace* the summary with
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
  timer runs only while the catalog is open *and* something is running; settled rows freeze at the
  last recorded interval cut rather than following the clock.

### 1.7 Icons and motion

`StateDot` is the shared status mark (`ui-primitives/src/StateDot.tsx`):

| State | Colour semantics | Drawing |
| --- | --- | --- |
| `done` | success | solid: 10% halo layer plus a 60%-scale core |
| `warning` | warn | same |
| `error` | error | same |
| `idle` | tertiary label | same |
| `ongoing` | running blue — the only state colour with no alias token, pinned to the static 450 step | eight 2x2 cells on a 10x10 grid, discrete brightness steps `1 -> 0.6 -> 0.35 -> 0.15` at 0/12.5/25/37.5%, `1s infinite`, each cell offset by `-125ms` so the chase starts mid-cycle |

Motion inventory for the conversation surface:

| Effect | Timing | Where |
| --- | --- | --- |
| Row sweep | `2.6s ease-out infinite`, 300px band, 90% hold | thinking, tool, bash, command, skill rows |
| Text shimmer | `1.8s linear infinite` | the per-turn running line |
| Retry shimmer | `1.6s ease-in-out infinite` | model retry row |
| Status chase | `1s infinite`, stepped | `StateDot ongoing` |
| Icon/chevron crossfade | `100ms ease` | disclosure rows |
| Disclosure rotation | `100ms ease` | process fold chevron |
| Catalog chevron | `120ms ease` | subagent tree |
| Rail width/colour | `140ms ease` | turn navigator |
| Rail position | `220ms cubic-bezier(0.2, 0.8, 0.2, 1)` | turn navigator |

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
process". Its styles are the `.thinking-*` block of `apps/web/app/styles/chat.css`; a question the agent must
ask is the assistant's own message; the composer is `apps/web/components/chat/Composer.tsx`.
Design tokens live in `apps/web/app/styles/tokens.css`, and progress frames are the
`AgentProgressEvent` discriminated union in `packages/shared/src/chat.ts`.

The surface now mirrors DSH row for row:

| DSH concept | This project | Location |
| --- | --- | --- |
| Per-turn process entry with a count line and a chevron | `ThinkRow` | `ThinkingProcess.tsx` |
| Expand-all / collapse-all beside the turn title | `ThinkRow`'s disclosure control | `ThinkingProcess.tsx` |
| Reasoning block as its own disclosure row | `ReasoningRow` | `ThinkingRows.tsx` |
| Per-agent rows with a summary and per-row expansion | `SubagentRow` | `ThinkingRows.tsx` |
| Per-tool rows with running/completed/failed states | `ToolRow` | `ThinkingRows.tsx` |
| Expanding a tool shows the result's own rows | `ToolRow` body | `ThinkingRows.tsx` |
| One "Deep diving" line per turn, with a 15s clock | `RunningLine` | `ThinkingRows.tsx` |
| State dot with a stepped chase | `StatusDot` | `ThinkingRows.tsx` |
| The decision an agent made, with its alternatives | `ChoiceBlock` | `ThinkingRows.tsx` |
| Round boundary explained before the work it caused | `RoundHeading` | `ThinkingRows.tsx` |
| The composer card | `Composer` | `Composer.tsx`, `composer.css` |
| Reduced motion for every effect | `prefers-reduced-motion` blocks | `chat.css`, `composer.css` |
| Textual state for assistive tech | `statusLabels`, `aria-label` on every row | `ThinkingRows.tsx` |

It is worth being explicit about what must not be undone: every row carries a text label for its
state, every expanded detail is a real `aria-expanded` button rather than a styled div, the running
line is the only live region in the transcript, and every animation is reduced-motion aware.

## 3. Where it diverges

The table below was the gap list at the time of the first port. Every row has since been closed; the
"Fixed by" column names the change that closed it.

| # | DSH | This project before | Consequence | Fixed by |
| --- | --- | --- | --- | --- |
| 1 | One running line per turn | `processSummary` could return `Deep diving · <tool>` *and* `.thinking-deep-dive` rendered a second "Deep diving" row whenever `busy` | Two live indicators describe the same turn | 4.1 — one `RunningLine`, one live region |
| 2 | Status is a state dot that never fades | Status was a text glyph (`· ✓ ! ■ ○`) animated by `thinking-pulse` opacity `0.35 <-> 1` | Fade reads as "loading", not "in progress"; glyph set is ad hoc | 4.2 — `StatusDot` with the stepped chase |
| 3 | Process rows fold behind one summary with counts | `ThinkingProcess` rendered `ThinkRow` plus all five `SubagentRow`s unconditionally | After completion the transcript kept a permanent five-row block | 4.3 — the process folds once the turn settles |
| 4 | Fold line names three counts | Expanded Think row said only `x/5 subagents have reported back` | No visible measure of tool-call or round volume | 4.3 — `N tool calls · M subagents · K rounds` |
| 5 | One sweep recipe: 300px, 90% hold | Two sweeps at 180px plus `thinking-pulse` on three different elements | The "running" language is not uniform | 4.4 — one `thinking-sweep`, 300px, 90% hold |
| 6 | SVG chevron rotating `-90deg -> 0deg`, 100ms | Text `⌄` with `translateY(-2px)` -> `rotate(180deg) translateY(2px)`, 160ms | Rotating a text glyph shifts baseline and does not match the fold timing | 4.6 — `ChevronIcon`, 100ms rotation |
| 7 | Elapsed clock after 15s, anchored at turn start | None | A long run had no sense of duration | 4.5 — the `RunningLine` clock |
| 8 | `role="status"` scoped to the running line | `aria-live="polite"` on the whole `.thinking-process` container | Every progress frame re-announced the entire process region | 4.7 — the running line is the only live region |
| 9 | Subcalls indent under the parent with a rail | Tool rows sat in `.thinking-subagent__tools` with no connector | Nesting was implied by position only | 4.6 — the subcall rail |
| 10 | Four states, and error is distinct from warning | Seven states, and `failed` and "needs attention" both used `--warn` | A failure and a warning looked identical | 4.2 — the dot, with a distinct text label per state |

Two smaller notes that are still true. `agentStatus` returns `unknown` and `interrupted`, which DSH
would render as `stopped`, and both keep their own text labels. And `docs/workspace-ui.md` described
the per-agent detail as "native, collapsed `<details>` controls" while `ThinkingProcess.tsx`
implements buttons with `aria-expanded`; that sentence now matches the code and links here.

### 3.1 Divergences that are deliberate, not debt

Five behaviours are intentional and should not be "fixed" toward DSH:

- **The transcript is a live view of one request.** `activity` is request-scoped; a finished turn
  keeps its rows, but there is no durable session to replay. There is therefore no store entry for
  fold state and no `hidden="until-found"`.
- **A tool's expanded body is the result's own rows, not a generic IN/OUT card.** This project's
  tools return domain data — stay candidates, places, route legs, flights — so the transcript
  publishes that data as bounded rows (`resultRows`, capped at `BOUNDED_RESULT_ROWS = 20`) instead
  of raw payloads in two 150px scroll boxes.
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
  and each revision pass — so a reasoning block is identified by `(agent, round, episode, index)`.
- **No model selector, permission chip or context meter in the composer.** This app has one model,
  one user and no token budget to show, so DSH's three chips would be inert. The composer keeps
  DSH's other control: the bottom-left attach control, which opens a file picker.

### 3.2 Asking the traveller

A choice the plan can make is not a question, and the app does not ask forms. Everything named in
this section as removed is gone from the tree; the names appear only so a reader who finds them in
git history knows why they went:

- **The plan decides.** The accommodation specialist already compares every eligible candidate and
  its proposal names one. The transcript reports that as `agent_completed.choice` — the selected
  stay, the specialist's own rationale, and the alternatives it compared — instead of a
  "Choose your stay" card waiting on the traveller every turn.
- **The contract that carries a question is gone.** An earlier cut of this work gave the coordinator
  an `ask_the_traveller` tool with up to four suggestions, a `needs_info.asked` frame, and a
  `QuestionPrompt` card in the transcript. All of it is removed: the coordinator asks in its own
  words, in one sentence, and the answer is whatever the traveller types next. The only structured
  thing left on the wire is the "not enough to plan yet" path — the assistant's question plus the
  fields already understood, with no option list.
- **No decisions anywhere, including the Trip drawer.** `HitlCheckpoint`, `TripPlan.hitl`,
  `checkpointsFor`, `applyHitl`, `/api/hitl`, `CheckpointCards` and the client `Decision` path are
  all removed. There is no "apply the traveller's decision" feature yet, so presenting a list of
  things to approve offered a capability that did not exist. A traveller who wants a change says so
  in chat or edits the trip; nothing waits for a confirmation they cannot give.

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
describes *what* is happening (`Working with Stay`, `Waiting for 3 subagents`); it never repeats
"Deep diving".

### 4.2 Status is a state dot

`StatusDot` renders an 8px dot with a 10%-opacity halo layer and a 60%-scale core, coloured from
the existing tokens (`--accent` running, `--ok` completed, `--warn` failed, `--text-mut` queued).
The running state uses the stepped chase — `thinking-chase` holds 1 -> 0.6 -> 0.35 -> 0.15 at
0/12.5/25/37.5% — not a fade, because a fade reads as loading. The dot is `aria-hidden`; every row
keeps its existing text label for assistive technology, which is also what separates a failure from
a warning.

### 4.3 The process folds once the turn settles

After a successful run the agent, reasoning and tool rows are hidden behind the Think row's count
line and reveal only on expansion; while running, or after an error, they are visible so the work
can be watched. The counts are accumulated once per render from `activity` (`countActivity`), not
derived by rescanning per row, and the line reads `N tool calls · M subagents · K rounds` with zero
parts omitted.

Unlike DSH there is no durability requirement for the fold state: the transcript is rebuilt from
`activity` on every request, so the expanded set lives in component state. One global
expand/collapse action sets every row at once, and a per-row toggle afterwards wins over it.

### 4.4 One sweep

`thinking-sweep` is the only sweep: a 300px band travelling `left: -300px -> 100%` over
`2.6s ease-out infinite` with a 90% end hold, reused by the running line and every running row.
`thinking-pulse` and the second sweep keyframe are gone, and the `prefers-reduced-motion` blocks
cover every animation in the surface.

### 4.5 Elapsed clock on the running line

`RunningLine` records the first frame of a run and hides the clock for the first 15 seconds, then
ticks at 1 Hz in `tabular-nums`; `busy` going false stops the interval. Fifteen seconds is DSH's
threshold and stays a reasonable default — short runs should not grow a clock.

### 4.6 Chevron and rail

Disclosure rows use `ChevronIcon`, rotating `-90deg -> 0deg` over `100ms ease`, so the timing
matches every other disclosure in the surface and no text baseline moves. Tool rows sit under their
agent behind a left rail (`padding-left` plus `border-left: 1px solid var(--border)`).

### 4.7 Narrow the live region

Done in 4.1: `aria-live` is on the running line alone.

### 4.8 Realtime reasoning, tool results and decisions

The contract this needed is new in `packages/shared/src/chat.ts`:

| Event | What it carries |
| --- | --- |
| `agent_reasoning` | One paced slice of a model's private reasoning, keyed by `(agent, round, episode, index)` |
| `agent_started.objective` | The bounded objective the supervisor handed that specialist |
| `tool_started.args` | The arguments the call was made with |
| `tool_completed.resultRows` / `resultTruncated` | The result's own rows, bounded, plus a flag when the head is all that was published |
| `agent_completed.outcome` / `choice` | What the round changed, and the option the specialist settled on |
| `needs_info.asked` | The question the agent posed, its context and its suggestions |

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
picker beside a quiet hint.

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
  so stopping is never mistaken for sending. The hint beside the attach control says which state the
  composer is in.
- **The text surface is a `textarea`, not DSH's contenteditable.** This app has no attachment chips
  or inline decorators inside the draft, so a textarea gives the three behaviours that matter here
  (grow, keyboard, own scroll) with far less machinery.

`chat.css` used to style `.chat__form`'s input and both buttons as a horizontal row; that block is
gone, and the form is now only the submit boundary around the card.

### 4.11 No calendar pop-up in the chat

The composer used to carry a calendar control and `ChatPanel` used to auto-open a date-picker dialog
when the assistant's message looked like a date question. A regex guessing at the assistant's intent
is not a good reason to open a modal, and it fought the conversation: a date question opened the
dialog *over* the surface the traveller was meant to answer on. Both are gone. A date question is now
answered in the conversation, dates can be typed in the composer at any time, and the real calendar
picker still lives in Trip preferences, where the traveller asks for it.

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
  `tokens.css`; borrow the *levels* (tertiary/secondary label, success/warn/error state, a running
  accent) rather than the names.
- **`StateDot`'s eight-cell matrix.** The stepped chase is worth keeping; the 8-cell pixel geometry
  is a DSH brand detail at 10px. An 8px halo-and-core dot with the same keyframes is closer to this
  app's existing icon weight.
- **DSH's model, permission and context chips.** They are real controls there; here they would be
  three inert chips. The composer keeps the attach control and omits those three (see 3.1).
- **DSH's question card.** There, a pending question replaces the input bar and is answered in one
  batched submission with its own pager, skip and cancel actions. This app does not ask structured
  questions at all (see 3.2), so there is nothing for such a card to hold.

## 6. Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test` for every step.
- `apps/web/tests/components/chat/ChatPanel.test.tsx` covers the chat surface: the count line after a
  settled run, the global expand/collapse control, a tool row's `resultRows` and its truncation
  note, a reasoning block's collapsed and expanded text, the stay choice and its alternatives, the
  round heading that appears only above round 1, and that no question card, no suggestion list and
  no confirmation card renders — the chat is a conversation.
- `apps/web/tests/components/chat/` also holds `ThinkingSurface.test.tsx` (fold, expand-all, tool
  detail, reasoning, choice), `Composer.test.tsx` (Enter/Shift+Enter/IME, the Stop swap, the attach
  control, and that no model/permission/context control exists), .
- `packages/orchestrator/tests/reasoning-sink.test.ts` pins the delta pacing and that one round's two
  model call chains cannot share a block identity; `chat.test.ts` pins the ask tool, including that
  its suggestions are capped and blanks dropped; `progress-tools.test.ts` pins the bounded result
  rows and that a provider error never reaches the transcript.
- The end-to-end shape was checked against the live provider: a three-day Sydney request streamed 19
  reasoning events and 15 tool results with their own rows (including `Search stays: 20 stay
  options` with 20 rows) plus one stay choice with 19 alternatives; and an ambiguous "Sydney in
  March" request produced a plain one-sentence question from the coordinator, which was answered in
  the traveller's own words and became the next turn. These are manual checks, not tests — they need
  `DEEPSEEK_API_KEY` and a few minutes.
- Browser checks: the composer was measured at 1280 and 420 px in both themes (no console error, no
  overflow, Stop replaces Send in place), and `/debug/thinking` was used to measure every transcript
  row. One trap that page caught: `apps/web/app/styles/forms.css` styles every
  button not on its exclusion list as a secondary button, so a new control inside the transcript or
  the composer arrives with a border, a surface and a padding that shift its grid columns.
  `.thinking-line`, `.thinking-control`, `.thinking-choice__toggle`, `.composer__primary`,
  `.question__icon-button`, `.question__option` and `.question__submit` are on that list.
- `/debug/thinking` (development only, `apps/web/app/debug/thinking/page.tsx` with
  `apps/web/lib/dev/thinking-fixtures.ts`) renders the transcript against a recorded frame sequence,
  settled and mid-flight, without a provider call. It is the fastest
  way to check a row's layout.

## 7. Sources

DSH, in the `deepseek-harness` repository:

| Topic | Path |
| --- | --- |
| Turn pipeline and publication cadence | `docs/subsystems/conversation.md` |
| Running line | `packages/client/ui-chat/src/client/chat/ChatView.tsx:168-201`, `ChatView.module.css:80-137` |
| Think row | `packages/client/ui-chat/src/client/chat/ReasoningRow.tsx`, `ReasoningRow.module.css` |
| Process fold | `TurnProcessNodeView.tsx`, `conversation-nodes/turn-process.ts`, `stores.ts`, `searchable-hidden.ts` |
| Tool rows | `packages/client/ui-tool/src/client/tool/components/ToolRow.tsx`, `ToolRow.module.css`, `models/tool-call-model.ts`, `ToolCallTree.tsx` |
| Status dot | `packages/client/ui-primitives/src/StateDot.tsx`, `StateDot.module.css` |
| Disclosure chrome | `packages/client/ui-primitives/src/DisclosureRow.tsx`, `DisclosureRow.module.css` |
| Icons | `packages/client/ui-primitives/src/icons/index.tsx` |
| Subagents | `packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx`, `subagent-lineage.ts`, `SubagentReadOnlyComposer.tsx` |
| Todo dock above the composer (consulted, then removed — see 4.9) | `packages/client/ui-conversation/src/client/skeleton/TodoPanel.tsx`, `TodoPanel.module.css` |
| Asking the traveller | `packages/client/ui-user-questions/src/client/QuestionComposer.tsx`, `contract/slots.ts`, `packages/interaction/user-questions/src/types.ts` |
| The composer card | `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`, `InputBar.module.css` |
| Streaming throttle | `packages/client/ui-conversation/src/client/conversation/assembly.ts:130-158`, `packages/api/session-controller/src/client/sessions/notifier.ts` |

This project:

| Topic | Path |
| --- | --- |
| Thinking surface | `apps/web/components/chat/ThinkingProcess.tsx`, `ThinkingRows.tsx` |
| Chat rendering | `apps/web/components/chat/ChatPanel.tsx` |
| Composer | `apps/web/components/chat/Composer.tsx`, `apps/web/app/styles/composer.css` |
| Stay decision | `ChoiceBlock` in `apps/web/components/chat/ThinkingRows.tsx` |
| Thinking styles | the `.thinking-*` block of `apps/web/app/styles/chat.css` |
| Design tokens | `apps/web/app/styles/tokens.css` |
| Progress contract | `packages/shared/src/chat.ts` |
| Reasoning stream | `packages/agents/src/reasoning.ts`, `packages/orchestrator/src/reasoning-sink.ts` |
| Thinking model routing | `packages/agents/src/models.ts` (`RoutedModelOptions`) |
| Tool result detail | `packages/orchestrator/src/progress-tools.ts` |
| Round and choice events | `packages/orchestrator/src/supervisor.ts`, `workflow.ts`, `chat.ts` |
| Icons | `apps/web/components/ui/icons.tsx` |
| Development fixture page | `apps/web/app/debug/thinking/page.tsx`, `apps/web/lib/dev/thinking-fixtures.ts` |
