# Agent Note: chat turns survive a page refresh

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

Refreshing the page while an agent was replying lost the reply for good. A turn lived only inside
one `POST /api/chat` NDJSON response: the browser kept no record that a turn was running, the server
stopped sending frames once the request aborted, and nothing stored the result where a reloaded page
could fetch it. After the reload the workspace also opened a new blank chat, so the conversation
showed the traveller's message with no answer.

## Decision

- The browser gives every turn a run id (`x-chat-run`) and stores `{ runId, task, message }` per
  conversation in `localStorage` (`trip-planner:pending-runs`, `apps/web/lib/workspace/pending-runs.ts`)
  until the turn finishes, the traveller stops it, or the chat is deleted.
- The route no longer ties the turn to the connection. It runs under `after()` and
  `apps/web/lib/chat/runs.ts` records every frame in `jsonStore` with a one-hour TTL.
- `GET /api/chat?run=<id>` replays the recorded frames and follows new ones, so the existing
  `readPlanStream`/`requestTurn` path applies the outcome unchanged.
- On load, the active conversation with a pending run is reopened instead of a blank chat, and the
  run is resumed; opening a conversation from history resumes its run too.
- A turn that ends only because the connection was lost (fetch or stream error, or the stream ending
  before a final frame) keeps its pending run, and so does any turn interrupted by `pagehide`.
- The local `jsonStore` fallback lives on `globalThis`, so route bundles in one process share it.

## Alternatives considered

**Keep the turn in browser memory only.** A reload clears it, which was the bug.

**A separate `/api/chat/runs/[id]` route.** Equivalent, but a new route also needs a protected
`scripts/verify-api-auth.mjs` entry; a `GET` on the existing public chat route avoids that.

**Stop the server run when the traveller presses Stop.** Stop never cancelled the server run before
either; the browser ignores the result. Cancelling server work is a separate change.

## Consequences

- Without KV on a multi-instance deployment, a replay can reach an instance that never saw the run
  and returns the "could not be recovered" notice with Retry. Configure KV for cross-instance replay.
- A run outlives the request only up to the platform's function duration limit.
- A message sent and refreshed within the 350 ms save debounce is restored from the pending run.
