# Agent Note: Trip prioritises itinerary review and adjustment

Status: proposed

## Problem

The supplied Trip screenshot puts an expanded budget and lengthy travel tips ahead of the selected
day's itinerary. Stop actions are difficult to discover and the wide panel leaves substantial space
unused. The traveller requested a major update to both UI and functionality using grill-with-docs.

Code inspection at `abc18859` confirms existing time, place, ordering, day, note, progress and booking
edits. These capabilities should inform the design rather than be treated as new functionality.
The empty-day view directs travellers to chat or to move an existing Stop from another day.

## Proposal

Accepted in interview round one (the traveller answered "all as recommended"):

- Cover desktop, tablet and phone with a shared information hierarchy and adaptive layouts.
- Make reviewing and manually adjusting a generated Plan the primary job. Also support use during
  travel, with today selected by default when applicable.
- Prioritise the selected day, its itinerary and actionable issues in the first screen. Keep a
  compact budget summary available and reveal travel tips on demand.
- Retain the existing Liquid Glass, colour and typography system while substantially reorganising
  layout, density and interactions.

Accepted in interview round two (the traveller answered "all as recommended"):

- Make Trip a dedicated desktop/tablet workspace. On wide screens, put the daily timeline beside
  a linked map and reveal details for the selected place. On narrower tablets, switch between the
  itinerary and map. Retain the phone Trip/Map entries and browsing context on return from chat.
- Provide an Add place action with search and manual entry. Make time, note and place-detail
  editing discoverable. Retain ordering, moving between days, moving to Ideas, removing and Undo.
  Allow an unlocated entry to remain and be matched to a place later.
- Focus budget features on planning estimates: known estimate, budget limit, unpriced-item count,
  and expandable category/item breakdown. Explicitly identify incomplete totals. Actual expense
  recording, splitting bills and payments are outside this redesign.

Accepted in interview round three (the traveller answered "all as recommended"):

- Keep day navigation available with per-day Stop counts and actionable indicators. Connect Stops,
  transport and stays in the daily timeline. During travel, default to today, provide Return to
  today, visit/skip actions and external map navigation, and retain a valid manually selected day.
- Route AI adjustments through chat with the selected day or Stop supplied as context. Manual edits
  save directly. Explicitly identify replanning when Brief requirements such as destination, dates
  or budget change, and retain the previous Plan if replanning fails. Automatic route optimisation
  and complete version management are outside this redesign.
- Show a compact issue summary that navigates to affected items and their actions. Distinguish
  time conflicts, unlocated places, unpriced items and lookup failures. Incomplete information must
  not prevent viewing or editing the Trip; individual invalid edits may still require correction.
- Extend draft protection to all device sizes. Preserve unsubmitted input across day/view/width
  changes; confirm a dismissal or Back action that would discard changed fields. Failed saves keep
  inputs and support retry. Applied manual changes retain an Undo action.

Accepted in interview round four (the traveller answered "all as recommended"):

- When adding a Stop, default to the selected day and offer an editable suggested time range.
  Require confirmation before saving and do not automatically move existing Stops. If the traveller
  is not ready to schedule it, offer saving as an Idea without a day or time. Failed search still
  permits a manually entered place with unknown location and price.
- Before sending a replan that can replace manual changes, explicitly ask the traveller to accept
  that replacement. Cancelling preserves the current Plan and sends no replan. Keep the existing
  Plan readable while generating; replace it only on success. Failure retains it. Automatic merging
  of manual edits is outside this redesign.
- Deliver four implementation tasks in one integrated PR: layout/map linking, direct editing,
  budget/issues, and draft protection. Validate complete journeys at desktop, tablet and phone
  widths in English and Chinese with repeatable browser evidence.

Q1–Q14 are settled. The traveller subsequently supplied a second screenshot showing the Agent Team
control competing with the Trip title, fact chips and actions as the interface becomes constrained.
The traveller accepted the extension below with "as you recommend" and confirmed the complete
proposal for ticket publication and implementation on 2026-10-26. Implementer and reviewer
subagents use GPT-6 Luna with high reasoning, as explicitly requested.

### Accepted extension: constrained workspace header (Q14)

The screenshot is reporter-provided reproduction evidence, not a new agent browser run. Static code
inspection at `abc18859` shows `TeamControl` always renders every team avatar and its label. The
`thinking.css` rule at 1000 px hides only the label and working-count text; it retains the avatar
row. The desktop leading group also holds Conversation/Trajectory and the Trip title, while fact
chips and trailing actions compete for the same row. This is a responsive-header bug distinct from
the Trip content redesign. No matching rejection directory is present in this checkout.

Accepted behaviour:

- Respond to the header's usable space, including sidebar expansion and long translated content,
  rather than rely only on a phone viewport breakpoint.
- With ample space, retain the expanded team entry. Under constraint, show a single team icon with
  a compact working count, and place individual specialist states in the existing team panel.
- Keep a clear accessible Agent Team name, keyboard access, and a non-colour-only working signal.
  Expansion of the entry must not depend on hover.
- Coordinate the whole header: prioritise the Trip identity and primary navigation/actions, and
  compact fact controls into a reachable summary when required rather than clip them.
- Cover this extension in the layout task. Check long EN/ZH Trip names, idle/working
  team states, expanded/collapsed sidebar, constrained desktop/tablet widths, and browser zoom.

Sources: [TeamControl](../../../../apps/web/components/chat/TeamControl.tsx),
[header composition](../../../../apps/web/components/workspace/WorkspaceView.tsx),
[team styles](../../../../apps/web/app/styles/thinking.css),
[header styles](../../../../apps/web/app/styles/workspace-layout.css).

### Resulting experience

The Trip header identifies the destination, dates and group. Compact budget and issue summaries
remain available without displacing the itinerary. Day navigation leads to the selected day's
timeline; wide layouts place the linked map alongside it, while narrow layouts retain a full view
for each. Selected-place details expose relevant edits. Travel tips open on demand.

Adding a place and saving as an Idea are distinct outcomes: a Stop has a day and confirmed time
range, while an Idea remains unscheduled. A place without coordinates remains visible in the
itinerary and can be matched later; it must not acquire an invented map position, route or price.
Time suggestions must be labelled as editable suggestions. Existing time validation still applies,
and a refused addition preserves the form and explains the correction needed.

Ordinary navigation retains an unfinished edit, including when the edited Stop is on another day.
The UI must keep a route back to that edit. Dismissal that destroys the draft asks to continue or
discard. An applied change exposes Undo last change; this does not imply a new multi-step history.
An AI context entry identifies the day/Stop being discussed but does not promise scoped regeneration.

### Delivery boundaries

| Task                   | Owns                                                                                                                                       | Integration boundary                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Layout and map linking | Dedicated Trip surface, day navigation, timeline density, linked selection/details, travel actions, tips and responsive workspace header   | Shared day/Stop identity, available header space and breakpoint behaviour       |
| Direct editing         | Search/manual addition, editable suggested time, Save as Idea, discoverable existing actions, Undo and AI context/replacement confirmation | Validated Plan actions, persistence and edit identity                           |
| Budget and issues      | Compact known-cost summary, unpriced counts, category/item breakdown and issue-to-action navigation                                        | Derive amounts and issues from the current Plan; consume selection/edit actions |
| Draft protection       | Retention through day/view/width changes, discard confirmation, failed-save retry and stale-edit handling                                  | Shared draft ownership and Plan revision rules                                  |

Agree the selection, edit and draft interfaces before parallel implementation. The tasks converge
on one integration branch and one PR, followed by a parent-owned complete-flow check. Run project
pre-push checks before every push; write the PR body with /pr on opening and updates. Once current
head CI passes, run /retro and stop. Merging and branch deletion require explicit instruction.

### Relationship to shipped decisions

This proposal builds on the [phone navigation decision](../../implemented/feature/2026-10-26-phone-workspace-navigation.md)
and [phone design](../../../../docs/design/mobile-workspace-redesign.md). It retains the accepted
Chat/Map/Trip/Mine navigation and shared day/Stop context. The dedicated desktop/tablet Trip workspace
proposes replacing the drawer surface described in the [workspace UI](../../../../docs/workspace-ui.md)
and the widening behaviour in the [layout decision](../../implemented/architecture/2026-10-06-workspace-layout-reducer.md).
Those shipped documents remain current until implementation. This does not supersede the phone
navigation decision; its statement that desktop/tablet navigation stayed unchanged describes the
previous phone-only delivery. All-device discard confirmation proposes replacing the desktop
Escape/outside-dismissal behaviour documented in the workspace UI; ordinary view/day/width changes
retain the draft rather than discard it. No shipped document is rewritten before implementation.

Use established terms: a Plan is the assembled result, a Stop is scheduled on a day, and an Idea
has no day. The interview has not introduced a new domain term requiring a glossary change.

## Alternatives considered

- A phone-only update was offered; the traveller chose desktop, tablet and phone coverage.
- Cosmetic changes alone do not meet the requested UI and functional update. The accepted
  direction retains visual foundations while reorganising the experience.
- Actual expense recording, bill splitting and payments were considered out of scope in favour of
  making planning estimates and their gaps understandable.
- Automatically merging manual changes into a generated Plan adds conflict resolution and history
  requirements. The accepted alternative is explicit replacement consent and preservation on failure.

## Acceptance criteria

- The completed interview records each accepted decision and leaves no implementation-driving
  question silently assumed.
- The resulting specification distinguishes existing capabilities from additions.
- Unknown costs remain distinguishable from zero, and estimates remain distinguishable from
  verified or actual amounts.
- The following failure inventory drives repeatable E2E checks before implementation. No browser
  scenarios have been executed for this proposal; it is a specification, not verification evidence.

| Scenario or failure                                                           | Required outcome                                                                                                                                           |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open an existing multi-day Trip                                               | The selected day and timeline take priority; budget and tips do not dominate the initial screen                                                            |
| Select a day or Stop on either the timeline or map                            | Both views identify the same valid day/Stop; unlocated Stops remain reachable in the timeline                                                              |
| Add through search, add manually, or save as Idea                             | Confirmed additions persist with correct identity; no invented position/price; Ideas have no day/time                                                      |
| A suggested time conflicts or validation refuses an edit                      | Existing Stops are not silently moved; entered values remain and the reason is actionable                                                                  |
| Change time/place/note, reorder, move days, remove, then Undo                 | Each action preserves unrelated fields and synchronises the Plan/map/budget; Undo reverses the last applicable change                                      |
| Costs are missing, zero, estimated or over budget                             | Unknown and zero remain distinct, totals disclose incomplete costing, and breakdowns correspond to current items                                           |
| Locate a time conflict, unlocated place, unpriced item or failed lookup       | The summary reaches the relevant item/action without blocking unrelated viewing and editing                                                                |
| Switch day, view or Trip/Map layout with dirty fields                         | Draft and a way back to it remain available; closing or Back that discards it requires a choice                                                            |
| A save fails or another revision overtakes an edit                            | Input remains recoverable; retry uses a current Plan and a stale result never replaces newer work                                                          |
| Start AI replanning after manual changes                                      | Cancellation sends nothing; accepted generation leaves the old Plan readable; failure preserves it and success replaces it                                 |
| Travel dates include today, or the traveller selects another day              | Default/today navigation uses the destination's resolved date; a valid manual selection remains selected                                                   |
| Reopen a Trip or switch between saved Trips                                   | Each restores valid browsing context and persisted changes without leaking another Trip's selection or draft                                               |
| Constrain the header with an expanded sidebar, long Trip name or browser zoom | Team entry compacts to one icon with an accessible name and working count; Trip identity and primary controls remain reachable without overlap or clipping |
| Open the compact team entry while idle or working                             | Keyboard and pointer access reach the specialist panel; working state remains understandable without colour or hover                                       |
| Use English/Chinese, keyboard navigation, dark/light themes or reduced motion | Labels remain usable, controls reachable, focus predictable and essential information independent of animation/colour                                      |

Cover representative desktop, tablet and phone sizes, plus the 520/521 and 1000/1001 px transitions, with
deterministic fixture data. Record exact revision, commands, assertions and screenshots. Fixture
evidence does not establish live provider correctness or physical-device behaviour. Reuse existing
today/time-zone and selection validity rules rather than introduce a second definition.
Exercise the header with both sidebar states, long English/Chinese labels and browser zoom;
viewport width alone does not establish the header's available space.

## Risks

- Redesigning Trip can disrupt shared map selection and unfinished editing across views or widths.
- More direct editing may require new domain actions, validation and persistence beyond UI work.
- A compact budget must still communicate incomplete costing without implying verified savings.
- Existing chat replanning replaces manual activities and clears the timeline Undo step. The new
  confirmation must cover every replan entry that can cause replacement, rather than only the Trip
  shortcut. Contextual chat requests must not imply that unrelated manual changes are protected.
- Screenshot labels alone cannot establish whether a live provider returned fixture data.

## Sources

- Traveller-supplied Trip screenshot and design interview on 2026-10-26.
- [Trip panel](../../../../apps/web/components/trip/TripPanel.tsx).
- [Trip editor](../../../../apps/web/components/trip/TripEditor.tsx).
- [Stop actions](../../../../apps/web/components/trip/timeline/TimelineStop.tsx).
