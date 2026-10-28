# Agent Note: Quiet itinerary panel walkthrough

Status: implemented
Owner: spec #755, ticket #764

## Problem

Spec #755 changed the Trip panel through eight tickets, each with its own E2E script. No run proved
the parts still work together, and a merge had already broken one of them: when Conversation and
Trajectory with the Trip panel open were fixed in the layout reducer, `sendFromTrip` stopped selecting
the chat view, so on a phone Ask AI sent its request and left the traveller on the Trip view.

## Decision

- `quiet-walkthrough` is the one E2E for the whole spec: panel order, one-line budget, ideas chip and
  its drop target, Ask AI in both menus, quiet rows, folded short tips, the sidebar without a Chats plus,
  Trajectory and Conversation with Trip open, and the restyled Trajectory, at 1440, 390 and 1440 in
  Chinese. It writes `result.json` and screenshots under `output/playwright/quiet-walkthrough/after/`.
- Ask AI from the Trip panel selects the chat view first and then the Conversation tab, so the phone
  leaves the Trip view as it did before the Trajectory change. The layout reducer's `show-chat-view`
  still keeps the phone view for team jumps.
- Builds on [the itinerary interaction decision](2026-10-27-itinerary-interaction.md) and
  [the ideas chip](2026-10-28-ideas-chip.md). No `packages/shared` change.

## Alternatives considered

- Make `show-chat-view` always select the chat on a phone: it would also pull a team jump off the Trip view.

## Consequences

- One run fails when any ticket of spec #755 regresses against another.
- Ask AI from the Trip panel always shows the chat; after an edit it still asks before replacing the edited plan.

## Sources

- Issue #764, spec #755.
