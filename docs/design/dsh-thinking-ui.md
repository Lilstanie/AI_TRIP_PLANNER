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
`apps/web/components/chat/ChatPanel.tsx:121-128` inside a `section.agent-activity` labelled
"Thinking process". Styles live in `apps/web/app/styles/chat.css:64-486`, tokens in
`apps/web/app/styles/tokens.css`. Progress frames are the `AgentProgressEvent` discriminated union in
`packages/shared/src/chat.ts:70-126`.

The structure already mirrors DSH closely:

| DSH concept | This project | Location |
| --- | --- | --- |
| Per-turn process entry with a summary and a chevron | `ThinkRow` | `ThinkingProcess.tsx:256` |
| Per-agent rows with a summary and per-row expansion | `SubagentRow` | `:202` |
| Per-tool rows with running/completed/failed states | `ToolActivityRow` | `:151` |
| "Deep diving" while work is in flight | `processSummary` and `.thinking-deep-dive` | `:104`, `:303-312` |
| Sweep on the running row | `.thinking-row::after` + `thinking-sweep` | `chat.css:111-131`, `:421` |
| Sweep on the running tool row | `.thinking-tool::after` + `thinking-tool-sweep` | `chat.css:356-374`, `:441` |
| Folded detail with a left rail | `DetailBlock`, `.thinking-row__details` | `:177`, `chat.css:285-309` |
| Reduced motion for the main effects | `chat.css:467-486` | |
| Textual state for assistive tech | `statusLabels`, `aria-label` on every row | `:17-25` |

It is worth being explicit about what is already right, so a later change does not undo it: every row
carries a text label for its state, the expanded detail is a real `aria-expanded` button rather than
a styled div, and the running effects are already reduced-motion aware.

## 3. Where it diverges

| # | DSH | This project today | Consequence |
| --- | --- | --- | --- |
| 1 | One running line per turn | `processSummary` can return `Deep diving · <tool>` *and* `.thinking-deep-dive` renders a second "Deep diving" row whenever `busy` | Two live indicators describe the same turn |
| 2 | Status is a state dot that never fades | Status is a text glyph (`· ✓ ! ■ ○`, `ThinkingProcess.tsx:57-71`) animated by `thinking-pulse` opacity `0.35 <-> 1` | Fade reads as "loading", not "in progress"; glyph set is ad hoc |
| 3 | Process rows fold behind one summary with counts | `ThinkingProcess` renders `ThinkRow` plus all five `SubagentRow`s unconditionally (`:317-345`) | After completion the transcript keeps a permanent five-row block |
| 4 | Fold line names three counts | Expanded Think row says only `x/5 subagents have reported back` (`:298`) | No visible measure of tool-call or round volume |
| 5 | One sweep recipe: 300px, 90% hold | Two sweeps at 180px (`chat.css:111-131`, `:356-374`) plus `thinking-pulse` on three different elements | The "running" language is not uniform |
| 6 | SVG chevron rotating `-90deg -> 0deg`, 100ms | Text `⌄` with `translateY(-2px)` -> `rotate(180deg) translateY(2px)`, 160ms (`chat.css:174-185`) | Rotating a text glyph shifts baseline and does not match the fold timing |
| 7 | Elapsed clock after 15s, anchored at turn start | None | A long run has no sense of duration |
| 8 | `role="status"` scoped to the running line | `aria-live="polite"` on the whole `.thinking-process` container (`:336`) | Every progress frame re-announces the entire process region |
| 9 | Subcalls indent under the parent with a rail | Tool rows sit in `.thinking-subagent__tools` with no connector (`chat.css:335-341`) | Nesting is implied by position only |
| 10 | Four states, and error is distinct from warning | Seven states; `failed` and "needs attention" both use `--warn` (`ThinkingProcess.tsx:10-25`, `chat.css:325-328`) | A failure and a warning look identical |

Two smaller notes. `agentStatus` returns `unknown` and `interrupted`, which DSH would render as
`stopped`. And `docs/workspace-ui.md` described the per-agent detail as "native, collapsed
`<details>` controls" while `ThinkingProcess.tsx` implements buttons with `aria-expanded`; that
sentence now matches the code and links here, so the remaining work is the fold itself, not the
description of it.

## 4. Changes, in priority order

Each step is independent and can land alone. Run `pnpm typecheck && pnpm lint && pnpm test` after
each, and verify the chat surface in a browser for the visual steps.

### 4.1 One live indicator per turn

Keep the `.thinking-deep-dive` row as the single running signal and stop letting the row summary
repeat it. When `busy`, the Think row summary should describe *what* is happening
(`Working with Stay`, `Waiting for 3 subagents`); the "Deep diving" line below carries the
indeterminate "still working" meaning once.

### 4.2 Replace the status glyphs with a state dot

Add a `StatusDot` component next to `apps/web/components/ui/icons.tsx` with the four states this
project needs, and use it in `SubagentRow` and `ToolActivityRow` in place of `statusIcon`:

```css
.status-dot {
  position: relative;
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-dot::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: currentColor;
  opacity: 0.1;
}
.status-dot::after {
  content: "";
  position: absolute;
  inset: 20%;
  border-radius: inherit;
  background: currentColor;
}
.status-dot--running {
  color: var(--accent);
  animation: thinking-chase 1s infinite;
}
.status-dot--completed {
  color: var(--ok);
}
.status-dot--failed {
  color: var(--error);
}
.status-dot--queued {
  color: var(--text-mut);
}
@keyframes thinking-chase {
  0%, 12.4% { opacity: 1; }
  12.5%, 24.9% { opacity: 0.6; }
  25%, 37.4% { opacity: 0.35; }
  37.5%, 100% { opacity: 0.15; }
}
```

The stepped keyframes are the point: DSH's chase holds each brightness step rather than tweening, so
it reads as a running indicator instead of a fade. Keep every row's existing `aria-label` — the dot
is `aria-hidden` and the text label stays the accessible state. Separating `failed` from a new
warning state needs a `--error` token; `tokens.css` currently has `--warn` only.

### 4.3 Fold the process once the turn settles

`ThinkingProcess` should render the summary row always and the five subagent rows only while
`busy`, or while the reader has expanded the fold. This is the single largest visual change and it is
what makes a finished conversation read as a conversation rather than a status board.

Mirror DSH's count line in the summary: count `tool_started` events, `agent_completed` events, and
distinct agents, and render `3 tool calls · 5 subagents · 2 rounds`, falling back to the current
summary when there is nothing to count. Derive the counts once with `useMemo` over `activity` rather
than rescanning inside each helper — `eventSummary` currently calls `latestLifecycle`, which copies
and reverses the array, on every render of every row.

Keep the fold's expanded state in the component; unlike DSH there is no durability requirement here,
because the transcript is rebuilt from `activity` on every request.

### 4.4 Unify the sweep

Move both sweeps to one 300px band with the 90% hold, driven by a single keyframe pair
(`thinking-sweep` is already the shared one). Delete `thinking-pulse` from the tool state and the
subagent toggle, since 4.2 replaces both with the chase; keep the pulse only if a non-row element
still needs it. Then extend the existing `prefers-reduced-motion` block at `chat.css:467-486` so
every animation added here is covered.

### 4.5 Elapsed clock on the running line

Record the time of the first frame of a run in `useWorkspaceController`, and show the elapsed
duration in `.thinking-deep-dive` once it passes 15 seconds, ticking at 1 Hz with
`font-variant-numeric: tabular-nums`. Stop the interval when `busy` goes false. Fifteen seconds is
DSH's threshold and is a reasonable default: short runs should not grow a clock.

### 4.6 Chevron and rail

Replace the text `⌄` in `ThinkRow` with the existing chevron icon from `icons.tsx`, rotating
`-90deg -> 0deg` over `100ms ease` so it matches the disclosure timing used elsewhere. Give
`.thinking-subagent__tools` the same treatment as DSH's subcall container — `padding-left` plus a
`border-left: 1px solid var(--border)` — so a tool row visibly belongs to its specialist.

### 4.7 Narrow the live region

Move `aria-live="polite"` off `.thinking-process` and onto the running line only, with
`role="status"`. Without that change every progress frame re-announces the summary, the five agent
rows, and their tool rows through the same region.

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

## 6. Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test` for every step.
- `apps/web/tests/components/chat/ChatPanel.test.tsx` covers the chat surface; extend it when the
  fold changes what renders after a run settles.
- Browser check for 4.2-4.6: run a plan in a browser, and confirm the running line, the dot, the
  sweep, the clock, and the fold in both themes at desktop and narrow widths.
- Confirm with the OS "reduce motion" setting on that the sweep, the chase, and the ellipsis stop
  while every state stays readable.
- Update the "Starting to plan" bullet in `docs/workspace-ui.md` again once 4.3 lands, because the
  fold changes what renders after a run settles.

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
| Streaming throttle | `packages/client/ui-conversation/src/client/conversation/assembly.ts:130-158`, `packages/api/session-controller/src/client/sessions/notifier.ts` |

This project:

| Topic | Path |
| --- | --- |
| Thinking surface | `apps/web/components/chat/ThinkingProcess.tsx` |
| Chat rendering | `apps/web/components/chat/ChatPanel.tsx:121-128` |
| Thinking styles | `apps/web/app/styles/chat.css:64-486` |
| Design tokens | `apps/web/app/styles/tokens.css` |
| Progress contract | `packages/shared/src/chat.ts:70-126` |
| Icons | `apps/web/components/ui/icons.tsx:146-169` |
