# Phone workspace redesign

English | [中文](mobile-workspace-redesign.zh.md)

Status: implemented and verified with fixture browser journeys. Physical-device safe areas, real
keyboard overlays and live providers remain outside that evidence.

## Confirmed scope

The traveller requested a substantial redesign of the entire phone workspace: navigation, chat,
map, plan editing and Mine. The primary journey is planning before departure: describe the trip,
inspect the proposed Plan, inspect places on the map, revise and save a Trip. Reading a saved Trip
while travelling remains convenient within that scope.

Keep the existing Liquid Glass language, semantic colours and system typography. Change information
hierarchy, placement and interaction rather than introducing a different visual identity.

## Confirmed interaction decisions

The traveller accepted the recommendations for Q4–Q14.

- **Primary navigation:** Chat, Map, Trip and Mine. Keep Trip hidden until a Plan exists, as in #713.
  Open Trajectory from the team entry in a full-screen view, retaining the space needed by the ledger
  and inspector. This replaces its bottom-tab placement, subject to a superseding Agent Note before
  implementation; it does not remove Trajectory functionality.
- **Mine:** saved Trips are the primary content, with recent chats secondary. Put search at the top,
  group account and settings behind one entry, and place creation actions beside the content they create.
- **Manual editing:** retain phone editing of dates, budget, Stops and Stop order. Use bottom sheets
  for Brief changes and a small popover on the row for Stop changes.
- **Map and Trip:** retain separate full-screen views, sharing the selected day and Stop. Contextual
  actions link them: opening a Stop on the map locates that Stop, and returning to Trip preserves context.
- **Chat:** a compact top trip summary opens Brief details; the composer stays at the bottom. Show at
  most two example prompts in a blank conversation and hide them once messages exist.
- **Planning feedback:** show available stages and specialist status inside chat. Completion offers
  a concise result and access to the updated Plan, preserving the traveller's active tab.
- **Failure handling:** retain the user's input when initial planning fails. If a revision fails, keep
  the current Plan readable, show a clear error and let the traveller explicitly retry.

## Implementation evidence

The baseline is main commit `9343038bb5a136fca97a9bfdd3a9bea361515003` (#713).

- `PhoneTabBar.tsx` exposes Chat, Map, Trip and Mine; Trip is absent before a Plan exists. The team
  entry opens Trajectory in the full phone panel.
- `PhoneMine.tsx` makes saved Trips primary, puts chats second, and keeps search, creation actions,
  data mode and Settings & account reachable. Opening a saved Trip lands on Trip.
- Map and Trip share the selected day and Stop. Selecting a Stop on one view locates the matching
  visit on the other, and revisions retain a valid day and clear only a removed Stop.
- Chat shows the compact Brief, at most two blank-chat examples, live specialist progress, and
  completion or failure feedback while preserving the active tab.
- Brief edits use bottom sheets; Stop edits open as a popover on the row. Unfinished
  Brief fields survive tab switches and confirm before a close discards them. Stop edits apply on
  submit and close without asking, failed changes keep their values, and an existing Plan uses the
  explicit Replan trip action.
- The repeatable fixture journey is `phone-navigation` under `apps/web/tests/e2e/`; `phone-shell --prod`
  verifies the integrated production shell.

## Failure inventory and acceptance evidence

These scenarios define the acceptance coverage of the repeatable browser journeys above.

| Failure scenario                                                              | Required observable result                                                              |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A Plan is created while the traveller is on Map or Mine                       | Trip becomes reachable; the active tab stays unchanged                                  |
| A Stop is selected on a later day, including a place visited on multiple days | Map and Trip show the same day and Stop; returning preserves context                    |
| A blank conversation gains its first message                                  | Example prompts disappear without obscuring the message or composer                     |
| Initial planning fails                                                        | User input remains available, the error is visible and explicit retry is reachable      |
| A revision fails after a Plan exists                                          | The previous Plan remains readable; no empty Plan replaces it                           |
| Trajectory opens from the team entry                                          | The ledger and inspector use the full viewport; closing returns to the originating view |
| Search, long titles or dense controls appear in Mine                          | Trips remain the primary content; chats, creation actions and settings remain reachable |
| A phone keyboard contracts the viewport                                       | Focused input and Send/Save remain visible; the bottom bar restores after typing        |
| The viewport crosses 520/521 px                                               | Current content and unsaved editing remain reachable                                    |

Follow [UI verification](../../.agents/skills/ui-verification/SKILL.md): phone 390 × 844, narrow phone
360 × 800, dense controls at 375 px, desktop 1440 × 1000, and the phone breakpoint transition. Cover
English and Chinese, keyboard/focus, overflow and relevant display preferences. Retain repeatable E2E
artifacts and screenshots with the exact revision, configuration and assertions. Real-device safe areas
and keyboards remain unverified unless actually exercised on a physical device.

## Confirmed edge cases

The traveller accepted the final edge-case recommendations:

- **Q11 — selection:** within the same Trip, retain a day if it still exists after revision; otherwise
  choose the nearest remaining day. Clear a removed Stop. Opening another Trip restores its own
  browsing position, defaulting to its first day if no valid position exists.
- **Q12 — unsubmitted edits:** tab switches retain Brief editing. A close or Back that would discard
  changed Brief fields asks whether to continue editing or discard; unchanged forms close directly.
  Stop edits no longer ask: the [instant itinerary edits Agent Note](../../.agents/notes/implemented/feature/2026-10-27-instant-itinerary-edits.md)
  supersedes this answer for the itinerary. Already applied changes retain their existing persistence
  semantics.
- **Q13 — edit scope:** retain replanning for destination/date/budget and other Brief updates to an
  existing Plan, with an action that makes that consequence clear. Keep Stop edits and automatic
  persistence; do not add a whole-Trip Save/Discard transaction or a new scheduling algorithm.
- **Q14 — opening saved Trips:** selecting a saved Trip in Mine opens Trip directly; selecting a recent
  chat opens Chat. This deliberately changes the phone's current saved-Trip landing behaviour.

The four implementation slices, navigation and Mine; shared Map/Trip browsing; chat planning feedback;
and editing protection, are integrated and verified together through the real workspace UI with
fixture providers.

## Existing contracts to carry into the design

- [UI guidelines](ui-guidelines.md) own semantic tokens, glass layering, typography and fallbacks.
- [Workspace UI](../workspace-ui.md) owns mounted panels, keyboard handling, safe areas and overlays.
- The [phone shell decision](../../.agents/notes/implemented/feature/2026-10-05-phone-shell.md)
  rejected a map squeezed above a half-height itinerary and navigation hidden behind extra menus.
- The [phone Trajectory decision](../../.agents/notes/implemented/feature/2026-10-24-phone-trajectory.md)
  gives the ledger its own full panel to avoid the chat composer consuming its space.
- The [phone Trajectory cards decision](../../.agents/notes/implemented/feature/2026-10-24-phone-trajectory-cards.md)
  owns readable record cards and touch targets; moving its entry must preserve its usable content.
- #713 deliberately hides Trip until a Plan exists. Any reversal needs an explicit design decision.
- Keep the current phone breakpoint, desktop/tablet behaviour, retained editing state and account data
  unless the interview establishes a reason to change them.
- Use the canonical Brief, Plan, Trip, Stop and Trajectory terms from [the glossary](../../GLOSSARY.md).

Fixture checks do not prove live-provider or real-device keyboard behaviour.
