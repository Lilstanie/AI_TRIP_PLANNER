# Agent Note: the team panel uses DSH's roster and task board, and a row opens the filtered trajectory

Status: implemented
Owner: spec #667, ticket #671

## Problem

The [specialist team panel](2026-10-23-specialist-team-panel.md) lists six rows and then a flat run of
assignments, which reads as a log. DeepSeek Harness (DSH) shows the same facts as a roster of member cards
and a board of task cards, which tutors comparing the two products expect. The panel's row press also
expanded a `Subagent` row inside the Think fold, a second place to read what the
[Trajectory tab](2026-10-24-trajectory-tab.md) now shows for the whole chat.

## Decision

- **DSH layout, our rules.** `TeamPanel.tsx` and `TeamPanel.module.css` are adapted from DSH's
  `TeamAction` (commit `687f282e86`, MIT header kept, listed in `THIRD_PARTY_NOTICES.md`). A Members
  section holds six cards in a two-column grid: icon, name, a state dot with the status, the Coordinator's
  Decided by AI or code tag, and the current assignment as a tag. An Assignments section holds one card per
  assignment: owner icon and name, state dot and status, a two-line description with Show more, then the
  kind (Dispatch, Revision, Hand-off), the Decided by tag and the data source. Conflict checks, revision
  scores and the stop reason are dashed rule cards with no icon; a conflict names the specialist it sends
  back and carries Needs change. The six rows, non-participant grey, the trigger, hover, pin and close
  rules, `teamModel` and the decided-by rules are unchanged. `StateDot` and `Tag` are copied into
  `trajectory/shim.tsx` with their styles in `shim.module.css`. The panel keeps its old `team-panel__*`
  hook classes so the E2E scripts keep their selectors; their styling moved to the CSS module.
- **A card opens the filtered trajectory.** Pressing an involved card closes the panel, selects the
  Trajectory tab (switching to the chat first when the Map is showing) and shows only that specialist's
  records, under a bar that names the specialist with a Show all records button. Idle and Not involved
  cards stay disabled. The request is `trajectory-focus.tsx` (renamed from `team-reveal.tsx`), read by
  `ChatPanel`, which owns the filter and keeps it across tab switches until it is cleared.
- **The filter lives in the adapter.** `buildTrajectory` takes `only`. A record belongs to the assistant
  named by its event: the Coordinator's summary and reply, a specialist's assignment, its tool calls and its
  reply. A conflict check or revision score belongs to the specialists it names; the stop reason belongs to
  none and shows only unfiltered. User records are hidden while filtered. Rows carry `data-assistant`.
- **Phone.** The phone sheet shows the same layout, but its cards have no action until the phone
  trajectory exists (#672 adds it).
- **Supersedes** the "Chat" paragraph of the 2026-10-23 note (a press expands the specialist's `Subagent`
  row and focuses it) and the panel body it describes (rows above a flat assignment list). The Think fold
  no longer reacts to the panel. Everything else in that note stands.

## Alternatives considered

- **Keep the thinking-row press and add a second action for the trajectory.** Two actions on one card
  hide which one a tap does, and the Think fold already shows its own rows.
- **Filter inside the copied ledger components.** The ledger takes turn models, so filtering there would
  have changed more copied code than the adapter does.
- **Open the phone trajectory from the sheet now.** The phone has no trajectory tab yet, so the press would
  have no target.

## Consequences

- An earlier turn's team still appears only in its Think fold; the panel shows the latest run, as before.
- `ThinkingProcess` no longer scrolls or focuses on a panel press, so the E2E journey `team-thinking`
  now checks the filtered trajectory instead.
- `ChatPanel` ignores the request on a phone.
- Updating the copy means diffing against DSH and keeping the hook classes and the Tag and StateDot shims.

## Sources

[2026-10-24 team panel session log](../../../session-logs/2026-10-24-team-panel-dsh-layout.md)
