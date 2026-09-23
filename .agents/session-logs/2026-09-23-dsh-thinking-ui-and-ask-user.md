---
date: 2026-09-23
author: Claude Sonnet 5
branch: feature/thinking-ui
pr: none
area: apps/web, packages/shared, packages/orchestrator, packages/tools
contract-impact: packages/shared
---

# Rebuild the thinking transcript to match DSH and add ask-user questions

## What changed

- Transcript: `ThinkingProcess.tsx`/`ThinkingRows.tsx` rebuilt on new `Disclosure.tsx` (DSH's
  `DisclosureRow` port: leading icon crossfades to a chevron, no trailing chevron), `thinking-model.ts`
  (tree derivation, `mergeReasoning`, `turnSummary`) and `ui/flow-icons.tsx` (DSH's 14px glyphs plus
  result-row category glyphs); styles moved to `app/styles/thinking.css`.
- Contract: `packages/shared/src/chat.ts` adds `ChatAskUser`, `AskUserQuestionItem/Option`,
  `ToolResultKind`, `ToolResultRow.kind`. `orchestrator/src/reasoning-sink.ts` gives every flush of
  one sink the same block `index`. `orchestrator/src/chat.ts` adds `ask_user_question`, `toQuestions`,
  `AskUserError`. `orchestrator/src/progress-tools.ts` adds `placeKind`/`travelKind`.
- Messages: new `MessageItem.tsx` (bubble/full-width Markdown via `react-markdown`, clock from
  `message-chrome.ts`), `Message.at`, `app/styles/messages.css`. Each reply carries its turn's
  frames as `Message.activity` and renders its Think fold above the answer.
- Ask-question card: new `QuestionComposer.tsx`, `lib/workspace/ask-user.ts`,
  `app/styles/question.css`, `/debug/question`; `workspace.ts`/`useWorkspaceTransport.ts` handle the
  `ask_user` frame and send answers as the next message with `known`.
- Result rows: `ToolResultRow.url` carries the page a provider genuinely returned (Google Places
  `websiteUri`, SerpApi stay details), so a row leads with that site's icon, host-only and
  referrer-free, and falls back to its category glyph; `Place.website` is new on the Maps port. A
  call's arguments render as one wrapped line instead of a definition list.
- Motion and chrome: the running line uses DSH's real `TextShimmer` recipe (currentColor, 250%
  background, 1.5s cubic-bezier) rather than the blue gradient §1.2 wrongly described; the composer's
  Stop control shares Send's circle and accent fill as in DSH; the composer hint slot is gone; a new
  reply reveals word by word (`RevealedText.tsx`, fade plus blur, ≤700ms, once per reply,
  reduced-motion aware).
- New Agent Note `.agents/notes/implemented/feature/2026-09-23-ask-user-question.md` supersedes the
  question half of `2026-09-22-remove-hitl-decisions.md` (its Consequences corrected in this PR, its
  Decision untouched — HITL checkpoints stay removed).
- Docs: `docs/design/dsh-thinking-ui.md` (§2, §3.2, §4 disclosure/rail/reasoning-identity, §5, §6, §7
  — including the Recommended badge's end-of-row placement, a deliberate deviation from DSH),
  `docs/workspace-ui.md`, `docs/architecture.md`.

## Why

The transcript borrowed DSH's vocabulary but not its behaviour: reasoning arrived as separate
mid-sentence fragments, rows had a trailing chevron plus an expand-all control DSH doesn't have, and
subagents sat beside Think instead of under it. Ask-user questions reverse only the question half of
`2026-09-22-remove-hitl-decisions`, because that removal's own stated reason (nothing consumed the
answer) no longer applies: the answer is now the next turn's message.

## Validation

- `pnpm -r typecheck` — clean; root `pnpm lint` — no warnings; `pnpm -r test` — 615 passed
  (web 248, agents 113, orchestrator 107, tools 107, shared 36, services 4).
- `pnpm verify:protected` and `pnpm verify:docs` — both passed.
- `pnpm --filter @trip/web build` — passed (it overwrites the dev server's `.next`; restart the dev
  server afterwards).
- Browser: `/debug/thinking` at 1280 and 375px — rows collapsed by default, one row opens per click,
  rails aligned, site icons and category glyphs side by side, arguments on one line, the shimmering
  running line. `/debug/question` — the question card in the composer's seat.
- One live `DEEPSEEK_API_KEY` run (4-day Sydney): 27 tool calls, 5 subagents, 3 rounds; the Think
  fold settled above its reply with clocks under both messages.
- Not run: a live check of the ask-user card (no ambiguous prompt was sent to the real model).

## Notes for the next person

`docs/design/dsh-thinking-ui.md` §1.2 claimed DSH's "Deep diving" line is a blue gradient sweep with
line numbers that point at unrelated code; DSH has no such treatment. The section now records what
DSH actually does. Treat the rest of §1 as worth re-checking against the DSH tree before copying.
