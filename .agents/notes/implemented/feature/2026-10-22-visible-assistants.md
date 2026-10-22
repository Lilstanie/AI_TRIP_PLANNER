# Agent Note: specialists become visible assistants in the chat

Status: implemented
Owner: spec #561, ticket #562

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
- Later tickets of #561 add mentions, hand-offs and renaming on top of the same ids.

## Sources

[2026-10-22 assistant team conversation log](../../../session-logs/2026-10-22-assistant-team-conversation.md)
