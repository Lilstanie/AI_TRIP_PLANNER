---
date: 2026-10-23
author: Claude Code
branch: fix/decided-by-badge-final
pr: none
area: apps/web, docs
contract-impact: none
---

# Decided-by badge appears only once it is final

## What changed

- `apps/web/components/chat/team-model.ts`: `teamMessages(activity, settled)` returns no
  `decidedBy` while the turn streams and no reasoning has arrived. Once reasoning arrives the value is
  `"llm"`, and once the turn ends without it the value is `"code"` (#600).
- `TeamConversation.tsx` renders the marker only when `decidedBy` is set and takes `settled`.
  `ChatPanel` passes `!busy`; saved messages in `MessageItem` pass `settled`.
- `apps/web/tests/e2e/decided-by-badge-final.e2e.mjs` and its failure inventory (written first). The
  E2E replays the real mock stream and holds the Coordinator's reasoning back until the end, then
  polls every marker every 50 ms.
- `docs/workspace-ui.md` and its Chinese pair.

## Why

The Coordinator's dispatch event arrives before its reasoning, so the card claimed "Decided by code"
and then switched to "Decided by AI". Joey chose on the decision card to show no badge until it is
final.

## Validation

- `node scripts/redgreen.mjs decided-by-badge-final -- <the four components>`: before, exit 1 with
  6/10 ok and the Coordinator flipping from code to AI in both languages; after, exit 0 with 10/10 ok.
- `assistant-team-conversation` E2E still passes, so every finished message carries a marker.
- Web unit tests 642 passed; typecheck, lint and the root `verify:*` checks pass.

## Notes for the next person

The reporter also saw the visible label change from "Coordinator" while streaming to "Travel
planning assistant" when the turn finished. That is a separate change and Joey's choice did not
cover it.
