# Agent Note: a Trajectory tab copies DeepSeek Harness's ledger and maps stored chats onto it

Status: implemented
Owner: spec #667, ticket #668

## Problem

The Think fold and the specialist team panel show one turn at a time. Nothing shows a whole chat in
order: the traveller message, the dispatch, each specialist's tool calls under its assignment, the
conflict check that sent a specialist back, the revision round and the reply. Tutors comparing this
product with DeepSeek Harness (DSH) expect its Trajectory ledger. The Agent Lab Trace view answers a
different question, the cost and timing of one benchmark run, and is not the place for a chat.

## Decision

- **Copy, do not depend.** The ledger table, timeline overview, toolbar, record types, search index,
  virtual-row grouping and their styles are copied from DSH commit `687f282e86` into
  `apps/web/components/trajectory/`, each keeping its MIT header. DSH packages are not dependencies. The
  copies drop compaction, images, the code program view, token usage and the system prompt and
  context records; their imports resolve through one local shim, `shim.tsx` (icons, tooltip, JSON and
  Markdown rendering). `@tanstack/react-virtual` is added for the ledger's row virtualisation, which
  starts above 100 records. `THIRD_PARTY_NOTICES.md` lists the files and no longer says the Trajectory
  view was written from scratch.
- **Record mapping.** `lib/trajectory/adapter.ts` builds DSH's turn model from `Message[]` and the stored
  `activity` events, with no change to `packages/shared`. A traveller message is User. A Coordinator
  summary and the reply are Assistant, named through the assistant-name setting. An `agent_started` event
  is a Tool record (an assignment) and a decision of type conflict, revision score or stop is a Tool
  record (a check, worded by `checkText`). A specialist's tool call is a Subtool under its assignment.
  A round is a step, the stored events carry no timestamps, so the overview orders by event and gives
  equal widths. Failed and stopped assignments and calls are marked failed.
- **The ledger is fed turn models, not conversation nodes.** DSH derives its ledger from a conversation
  snapshot of nodes, requests and partial blocks. Reproducing that snapshot would have copied or
  imitated most of DSH's conversation store, so the adapter produces the layer below it, the turn
  model, and `TrajectoryTable` reads it directly. Step markers reuse DSH's request dots.
- **Lanes follow DSH here.** The overview's lanes are User, Assistant and Tool, as in DSH, so a viewer
  who knows DSH reads this ledger unchanged. The Agent Lab Trace keeps its own lanes, which are
  per-agent, under
  [its own note](../architecture/2026-10-07-agent-lab-trace-step-axis.md); the two views answer different questions and
  neither follows the other.
- **Tabs.** On desktop `ChatPanel` shows Conversation and Trajectory tabs. The stream stays mounted and
  hidden so its scroll position and animations survive, and the Trajectory is mounted only while open.
  Phone width has no tabs.

## Alternatives considered

- **Depend on the DSH packages.** They are not published and assume DSH's store; rejected.
- **Shim DSH's conversation snapshot.** Needs nodes, requests, event locations and call schemas that
  the app has no source for; rejected for the turn-model adapter above.
- **Write a ledger from scratch.** Loses the proven interactions (folds, search, inspector, overview)
  and the likeness to DSH that the audience expects.
- **Reuse the Agent Lab Trace view.** It is built around benchmark runs and costs, not chats.

## Consequences

- Updating the copies is manual: diff against DSH and keep the header and the shim imports.
- The overview carries no durations, so it cannot show where a turn was slow; adding timestamps to
  `AgentProgressEvent` would be a `packages/shared` change with its own note.
- Virtualisation has no dedicated test in this ticket; the E2E chats stay below the threshold.
