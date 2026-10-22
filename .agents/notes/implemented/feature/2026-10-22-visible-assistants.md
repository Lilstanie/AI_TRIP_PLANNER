# Agent Note: specialists become visible assistants in the chat

Status: implemented
Owner: spec #561, tickets #562, #563, #565 and #566

## Problem

The traveller talks to one chat, and the five specialists appear only as `Subagent · <name>` rows inside
the Think fold. From the traveller's side the app looks like a single assistant, and tutors cannot see who
perceives a request, who decides and how the specialists work together.
[Specialist content moves into the one day view](2026-10-08-day-view-specialists.md) and decision 9 of
spec #233 ("no specialist view; the chat planning process and Agent Lab cover the three-role demo") ruled
out a specialist view in the Trip drawer.

## Decision

- The Coordinator and the five specialists are six **assistants** with fixed icons from the existing icon
  set (`components/chat/assistants.tsx`). The Coordinator is shown but is not a specialist.
- A planning turn reads as a team conversation above its Think fold (`TeamConversation`,
  `team-model.ts`). Every message maps to a streamed event: the Coordinator's dispatch from the
  `coordinator` event and each `agent_started.objective`, and a specialist's result from
  `agent_completed`. A step is marked as decided by AI when the stream carried reasoning for that
  assistant in that round, and as decided by code otherwise.
- `packages/shared/src/chat.ts` gains, all optional: `AssistantId` (`coordinator` plus the specialist
  ids), `ChatResponse.assistant`, `agent_reasoning.assistant` and `agent_completed.source`. A missing
  assistant id reads as the Coordinator, so older clients and stored conversations still render.
- A message can mention specialists (ticket #563). `ChatRequest.mentions` carries specialist ids, and
  `ChatNeedsInfo.assistant` attributes a no-plan answer. The client resolves typed `@name` against the default
  English and Chinese role names (`components/chat/mentions.ts`). With a plan, `runTripChat` passes the
  mention to the planning graph (`OrchestratorOptions.mention`): its dispatch node reuses the plan's other
  proposals, runs only the mentioned specialists in parallel with the message as the revision reason, and the
  existing conflict check and targeted revision follow. Without a plan the specialist answers and the
  Coordinator asks for the brief; nothing is created.
- A mention that names the wrong specialist is handed off once through the Coordinator (ticket #565).
  `runTripChat` asks `judgeHandoff` before the planning graph runs: with a model, the mentioned specialist
  answers `own` or the id it thinks owns the request; without a model, or when the answer is unusable, a
  keyword rule decides, so fixtures repeat exactly. The shared `mention_handoff` decision carries `from`,
  `to` and who decided it. The planning graph then runs only the receiving specialist, so no specialist
  ever invokes another and only the receiving specialist's section can change.
- Each assistant can be renamed in the assistant settings (ticket #566). `AssistantSettings.names` is an
  optional id-to-name map stored with the account. The interface shows the custom name, or the role name
  in the interface language when none is set. Names are trimmed, at most 24 characters, and unique across
  custom names and default English and Chinese role names. `@` resolves by custom, default English or
  default Chinese name, and a mention is still sent as an id.
- The Think fold stays as a details view, and its Subagent rows use the assistant icons.
- This partly supersedes the 2026-10-08 note and decision 9 of #233: specialists are visible in the chat,
  but the Trip drawer is unchanged.

## Alternatives considered

**Five separate chat windows.** Rejected: separate windows would hide the collaboration, and an edit made in
one window would not update the budget or the itinerary.

**Show the specialists in the Trip drawer.** Rejected: the day view already carries their content, and
assistant icons would clutter it.

## Consequences

- The team conversation shows only what a stream carried; a step without reasoning reads as decided by
  code, which is also what fixture mode shows.
- Mentions, hand-offs and renaming sit on top of the same ids, and the demo runbook walks through all of them (ticket #567).

## Sources

[2026-10-22 assistant team conversation log](../../../session-logs/2026-10-22-assistant-team-conversation.md)
