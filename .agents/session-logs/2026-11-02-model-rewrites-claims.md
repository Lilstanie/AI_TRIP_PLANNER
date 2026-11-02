---
date: 2026-11-02
author: Claude Code
branch: fix/TP-262-model-rewrites-claims
pr: none
area: packages/orchestrator, docs
contract-impact: none
---

# The model rewrites unsupported claims instead of a fixed sentence

## What changed

- `packages/orchestrator/src/chat/chat-grounding.ts`: `ungroundedClaim` names the fact that
  contradicts a reply; `truthfulReply` asks the model to rewrite the reply given it and falls back
  to the fixed sentence when the model fails or the rewrite still makes the claim.
- `packages/orchestrator/src/chat/chat.ts`: the conversation agent uses the rewrite wherever it used
  `groundedReply`; an unchanged replan keeps the model's own reply unless it claims a change.
- `packages/orchestrator/tests/chat.test.ts`: the prompt recorder skips the rewrite call.
- `docs/api.md`, `docs/api.zh.md`, Agent Note
  `.agents/notes/implemented/bug-fix/2026-11-02-follow-up-chat-confirm-and-grounding.md`.

## Why

Joey asked why the planner answers with fixed sentences. Inventory of fixed reply text:

- Replaced outright: "I can't verify that requested change…" and "I rechecked the itinerary, but no
  changes were applied…".
- Appended: the code-written cost sentence, kept per `2026-10-24-code-cost-sentence.md`.
- Only without a model or with an empty model reply: offline replies, the section-summary fallback,
  and the brief questions after an @-mention before a plan exists.

## Validation

See the PR body for the commands run and their results.

## Notes for the next person

Joey is deciding whether the cost sentence should move to the model as well.
