# Agent Note: a specialist team panel and an @ menu replace the chip row and team conversation

Status: implemented
Owner: spec #629, tickets #630, #631, #632, #633 and #634

## Problem

[Visible assistants](2026-10-22-visible-assistants.md) made the Coordinator and the five specialists
visible, but the result does not show them working together. Six chips take a row above the message box
and only append `@name` text, which can then be removed only character by character. Collaboration
appears twice, as `TeamConversation` text rows and as nested `Subagent` rows in the Think fold, and
neither shows at a glance who was given what, who is still working, which specialist a conflict sent
back or whether a revision was kept. Tutors should see the team's structure, not read a log.

## Decision

- **Team panel.** A Specialist team (专家团队) button in `topbar-actions`, left of Trip, opens the team
  panel (`TeamControl`, `TeamPanel` in `components/chat`). Hover opens it, a click pins it, Escape or a
  press outside closes it, and it never opens by itself. The panel lists the six assistants every time,
  in `ASSISTANT_ORDER`, each with status and one-line objective, then the turn's **assignments** (the
  glossary term): a specialist's first dispatch, a targeted revision or a hand-off, with owner, status,
  data source and the AI-or-code marker kept from #558, plus the conflict checks, revision scores and the
  stop reason. At phone width the same panel opens as a bottom sheet from an avatar button beside the
  trip title (#632); it reuses `TeamPanel` inside the shared modal sheet, held in the layout `sheet` slot
  next to Trip details so the two never open together.
- **Derived on the client, no contract change.** `teamModel` in `team-model.ts` turns an activity list
  (`AgentProgressEvent[]`) into six rows, the ordered assignments and checks and a working count. The
  button avatars, the panel and the reply summary read it, and `TeamPanel` takes a run's activity as
  input, so the live turn and a saved reply's run share one component. `packages/shared/src` is not
  touched. Status mapping: Working is started with no completed or failed in the latest round; Done is
  completed; Failed is failed; Needs change is named by the latest conflict check and not yet revised; Not
  involved is no assignment this turn; Idle is before any event.
- **Who decided.** An assignment is marked AI when the stream carried that specialist's reasoning in that
  round, and code once the turn ends without it. The Coordinator row carries the marker for the dispatch,
  and a hand-off carries `mention_handoff.decidedBy`. Speakers still come only from real events.
- **Chat.** The live area above the message box shows only the Think fold, so `TeamConversation` leaves
  it. Each saved reply a specialist worked on starts with a one-line summary that opens that run's panel
  (#633), and a reply only the Coordinator wrote has none. Pressing a specialist in the panel scrolls to
  and expands that specialist's Think rows (#634).
- **@ menu.** The chip row is removed. Typing `@` opens a menu of the six assistants with icons,
  operable from the keyboard (arrows, Tab or Enter to pick, Escape to close without changing the draft)
  and announced through `aria-activedescendant`. A mention stays plain text in the textarea; right after
  an `@name` the first Backspace selects the whole mention and the second deletes it. `resolveMentions`
  and the request are unchanged (#630).
- This partly supersedes [Visible assistants](2026-10-22-visible-assistants.md): the chip row and the team
  conversation rows are replaced by the @ menu, the team panel and the reply summary. Its icons, names,
  routing, mention resolution and hand-off rules stand, and the Trip drawer still shows no specialists.
- This replaces the display built for #558 and keeps its data rules.

## Alternatives considered

**Keep the chip row and add the panel.** Rejected: the row costs vertical space and a press only appends
text, which the menu does better.

**A rich-text composer with atomic mention chips.** Rejected: plain text keeps `resolveMentions`, the
request and stored drafts unchanged, and two Backspaces give the same safety.

**A node-and-edge graph of the team.** Rejected as out of scope: rows and assignments answer who was
given what and who is working without a layout engine.

**Put the panel in the Trip drawer.** Rejected: the 2026-10-08 decision stands, and the drawer is for the
trip.

**Mark only the Coordinator or only the specialists as decided by AI or code.** Rejected: the dispatch and
each specialist's work can differ, and the tutor needs both.

## Consequences

- The panel shows only what a stream carried. A turn from fixture mode reads as decided by code, and an
  interrupted turn shows its unfinished assignments as Stopped.
- The panel follows the latest turn: the live stream while one runs, otherwise the newest saved agent
  reply's activity, so a reload keeps it.
- Until the reply summary lands, a saved reply still renders its team conversation rows from a legacy
  model (`team-messages.ts`) that the summary ticket deletes with `TeamConversation`.
- A new client model has to be kept in step with `AgentProgressEvent` by hand, since no contract
  carries assignments.

## Sources

[2026-10-23 team panel desktop log](../../../session-logs/2026-10-23-team-panel-desktop.md)
[2026-10-23 team panel phone log](../../../session-logs/2026-10-23-team-panel-phone.md)
