# Phone workspace redesign

English | [中文](mobile-workspace-redesign.zh.md)

Status: design confirmed by the traveller. Implementation is pending; existing runtime decisions remain in force until the change ships.

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
  for individual changes and a full page for complex editing.
- **Map and Trip:** retain separate full-screen views, sharing the selected day and Stop. Contextual
  actions link them: opening a Stop on the map locates that Stop, and returning to Trip preserves context.
- **Chat:** a compact top trip summary opens Brief details; the composer stays at the bottom. Show at
  most two example prompts in a blank conversation and hide them once messages exist.
- **Planning feedback:** show available stages and specialist status inside chat. Completion offers
  a concise result and access to the updated Plan, preserving the traveller's active tab.
- **Failure handling:** retain the user's input when initial planning fails. If a revision fails, keep
  the current Plan readable, show a clear error and let the traveller explicitly retry.

## Current evidence

The baseline is main commit `9343038bb5a136fca97a9bfdd3a9bea361515003` (#713).

- `PhoneTabBar.tsx` exposes Chat, Map, Trip, Trajectory and Mine. Trip is absent before a Plan exists.
- `PhoneMine.tsx` combines chat history, saved Trips, search, creation actions and settings.
- Map and Trip occupy separate phone panels. Map has a draggable day-stops sheet.
- Opening a saved Trip currently selects Chat on a phone (`apps/web/lib/workspace/layout.ts`).
  The confirmed design changes that destination to Trip.
- Fact editing of an existing Plan invokes replanning; individual Stop edits apply locally or through
  a revision preview. Workspace state is automatically persisted (`TripFactChips.tsx`,
  `TripEditor.tsx`, `useWorkspaceStorage.ts`). Retaining editing does not establish a new manual
  transformation of dates, accommodation or transport.
- Map and Trip currently own separate day state despite sharing Stop selection. A revision clears
  the selected Stop; day restoration follows separate rules (`useWorkspace.ts`, `TripEditor.tsx`,
  `session.ts`). Q7 requires one coherent browsing context.
- Closing an editor currently discards its local unsubmitted state without confirmation, including
  through phone Back (`StopForms.tsx`, `FactPopover.tsx`, `usePhoneBack.ts`).
- Retained #713 screenshots at 390 × 844 show the empty chat and Mine. These support the design
  discussion; they are not new browser verification of this redesign.

These are existing behaviours and design opportunities, not newly reproduced defects.

## Failure inventory and acceptance evidence

These scenarios define required evidence for implementation, not checks already performed.

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
- **Q12 — unsubmitted edits:** tab switches retain editing. A close or Back that would discard changed
  fields asks whether to continue editing or discard; unchanged forms close directly. Already applied
  changes retain their existing persistence semantics.
- **Q13 — edit scope:** retain replanning for destination/date/budget and other Brief updates to an
  existing Plan, with an action that makes that consequence clear. Keep Stop edits and automatic
  persistence; do not add a whole-Trip Save/Discard transaction or a new scheduling algorithm.
- **Q14 — opening saved Trips:** selecting a saved Trip in Mine opens Trip directly; selecting a recent
  chat opens Chat. This deliberately changes the phone's current saved-Trip landing behaviour.

Design confirmation is complete. The traveller also approved four implementation tickets: navigation
and Mine; shared Map/Trip browsing; chat planning feedback; and editing protection. These slices have
no functional blocking edges and will be integrated into one pull request. Each slice verifies its
behaviour through the real workspace UI with fixture providers; integration verifies the complete journey.

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

Once the design is agreed, record any superseding decisions before implementation and define a
failure inventory with repeatable browser evidence. Fixture checks do not prove live-provider or
real-device keyboard behaviour.
