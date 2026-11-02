---
date: 2026-11-02
author: Claude Code
branch: fix/TP-257-follow-up-chat
pr: none
area: apps/web, packages/orchestrator
contract-impact: none
---

# Follow-up chat turns no longer ask to replace edits or hide applied changes

## What changed

- `apps/web/components/workspace/useWorkspaceTransport.ts`: `settleBackground` moves the unedited
  snapshot forward after automatic saves; the snapshot carries its trip id, and no snapshot means no
  confirm.
- `useWorkspaceTripEditor.tsx` and `useWorkspace.ts` pass a background apply's base plan to it.
- `packages/orchestrator/src/chat/chat-grounding.ts`: a materially changed plan backs a change claim
  the guard cannot parse.
- Agent Note `.agents/notes/implemented/bug-fix/2026-11-02-follow-up-chat-confirm-and-grounding.md`.

## Validation

- Live repro on the deployed site with the admin passcode (Perth to Bali prompt + 3 follow-ups):
  confirm on every follow-up; recorded stream showed the change applied and the reply replaced.
- `pnpm --filter @trip/orchestrator exec vitest run`: 430 passed.
- `pnpm exec vitest run tests/components tests/lib/workspace` (web): 285 passed.
- `pnpm turbo run typecheck --filter=@trip/web --filter=@trip/orchestrator`: pass.
- Local dev in mock mode: no confirm, but mock plans get no automatic place saves, so the fix is
  verified on the deployed site after merge.

## Notes for the next person

Server short-term chat memory is per process unless KV is configured on Vercel.
