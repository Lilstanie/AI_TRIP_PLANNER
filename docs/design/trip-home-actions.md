# Trip home action rail

English | [中文](trip-home-actions.zh.md)

Status: implemented.

This design extends the current [Trip home](../workspace-ui.md#layout). That page still lists the
Trip's chats and uses its own saved Plan. The new work moves the five plan actions into a right rail
and opens each action without leaving Trip home.

## Layout

On desktop, selecting a Trip opens Trip home with spacious main and right columns centered together.
The pair has 24px outer insets and a 1440px maximum width; tablet and phone retain their full width.

| Area       | Content                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Main       | Trip title and facts, a contextual AI suggestion, every Chat linked to this Trip, and a composer       |
| Right rail | Five action cards followed by the embedded Trip map                                                    |
| Overlay    | A right-side drawer for the chosen action; it covers the right rail and leaves the main column visible |

Opening a Chat navigates to the normal conversation workspace with its existing chat/map split.
Trip home is the dashboard for selecting Chats and managing the Trip; its conversations are not
embedded inside it.

## Chats and suggestions

- Trip home lists every Chat whose `tripId` is the open Trip. One Trip can have any number of Chats.
- Choosing a Chat opens it in the normal Chat workspace, retaining its Trip association.
  The first send and contextual suggestions navigate to that same workspace after creating the Chat.
- The first nonempty send creates one linked Chat and sends once with the current Trip Plan.
  There is no separate Start chat action. Focus, typing, clearing and empty submission create nothing.
  Enter sends, Shift+Enter inserts a line break, and IME confirmation does not send. Switching Trips
  clears an unsent home draft. A failed first send keeps its Chat and user message; Retry reuses both.
- First send focuses the normal Chat composer. The conversation uses its own scroll region and
  preserves the existing phone Chat tab navigation.
- The Chat heading shows its count. Rows show a message-derived title, localized date and forward
  affordance; manually renamed titles are preserved. Opening an older Chat keeps the Trip's newer Plan.
- A suggestion is generated from the open Trip's current Plan. Choosing a suggestion sends its
  prompt through the same first-send Chat flow. The suggestion, Ideas count and Ideas list share
  one selection rule for unscheduled activities and restaurant suggestions.
- Dismissing a suggestion remembers that choice for the Trip until the Plan changes. A new Plan
  makes suggestions eligible to appear again. A full store still dismisses for this visit and reports
  persistence failure. Null or malformed dismissal records are ignored without changing Trip data.

## Actions

The action cards appear in this order, each with a leading decorative icon. Each card opens a Trip action drawer and includes a count
when it has one. Counts are bare numbers aligned at the right of the title on the same row,
without unit labels. The bottom composer uses Chat's surface directly; its layout wrapper adds no
background, border or shadow.

| Action           | Drawer content                                                                                                                | Interaction                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Itinerary        | The same editable Trip view as the conversation, with activities, flights, stays, pending edits and Undo                      | Edit in place; choosing a day focuses that day on the map                                                        |
| Ideas            | Unscheduled activities and restaurant suggestions                                                                             | An item can be scheduled through the existing itinerary editing flow                                             |
| Bookings         | Flights, stays and other itinerary items marked as booked                                                                     | Booked items remain grouped independently of their itinerary order                                               |
| Trip preferences | The existing preference editor for this Trip                                                                                  | Changes use the existing save and replan behavior                                                                |
| Calendar         | A Week/Month view for this Trip only; it groups timed activities and all-day stops, flights and stays without inventing times | Choose an activity to open it in the shared Itinerary editor; choosing a day opens Itinerary and focuses the map |

Media is intentionally absent until the product has a real media model. The drawer set does not add
Receipts.

## Drawer behavior

- On desktop, an action opens as a narrow right panel over the action cards. The panel starts
  collapsed; Expand offsets the drawer so the action content sits beside the Trip map that stays in
  the right rail, and Collapse restores the narrow panel over the action cards. The map host and its
  canvas remain under Trip home for both states, so expansion never remounts a second renderer.
- Inside the open panel, five tab controls switch among Itinerary, Ideas, Bookings, Trip preferences
  and Calendar without closing first. Expansion, the open Trip, Chat, selected day and unsubmitted
  edits survive those switches.
- On a phone, the same drawer fills the screen and slides in from the right. Expand is desktop-only.
- A close button, Escape and a press outside the drawer all close it, restore the Trip home scroll
  position and return focus to the action card that opened it.
- Nested time editors and Settings keep their own Escape and close precedence ahead of the action
  panel.
- Only one Trip action drawer is open at a time.
- The drawer is a labelled dialog with a visible heading. Its content remains keyboard reachable
  and does not create a second page history entry.
- Bookings keeps the existing non-AUD estimate and exchange-rate notice. Flights headings and
  schedule accessible names come from the translation catalogue in English and Chinese.
- Itinerary and the conversation Trip use one latest Plan, activity identity, selected day, pending
  edit and Undo record. A change or Undo in either entry updates the other, Calendar and the map.
  Days containing only flights or stays show as booked instead of free.

## Phone layout

Trip home becomes one column in this order:

1. Title and facts.
2. Contextual suggestion.
3. Five action cards.
4. Chats.
5. Trip map.
6. Composer.

The main page keeps a single scroll region above a fixed bottom composer, so a long Chat list leaves
Send visible. Opening an embedded Chat on desktop turns that region into a flex column so the Chat
transcript scrolls inside the Chat surface; list-mode Trip home keeps the page scroll. An action
drawer uses the full screen and the same close and focus rules as desktop.

## Boundaries

- This design keeps the existing Trip home entry points, title, facts, Rename and Delete menu,
  latest-Plan rule and links between multiple Chats.
- It replaces the current action cards that navigate to the conversation Trip panel, the global
  Calendar page or the Preferences editor.
- It adds Ideas and Bookings views without adding new data concepts.
- It does not turn Trip home into a stored page that is restored after reload.
- It does not add Media or Receipts.

## Acceptance

The implementation is complete when browser E2E covers:

- A Trip with at least two Chats lists both Chats and opens the chosen one.
- Sending from the Trip home starts a new Chat linked to the same Trip.
- Each of the five action cards opens its drawer without leaving Trip home.
- Home Itinerary and the conversation Trip render the same activities, flights and stays and keep
  Plan edits and Undo synchronized.
- The desktop panel opens narrow, can expand beside the map and collapse again without losing
  Trip, Chat, selected day or edit state; the phone drawer fills the screen.
- Close, Escape and outside press restore focus to the opening card; list-mode Trip home also restores page scroll.
- In-panel tabs switch actions without closing first, including across expand and collapse.
- Non-AUD Bookings show the estimate notice; Flights and schedule names stay translated.
- Calendar opens in Week view, keeps the selected Trip day across Week and Month changes, and keeps
  Previous and Next inside the Trip. Choosing an activity opens that activity in the shared Itinerary
  editor; choosing a day opens Itinerary at that day and focuses the map.
- Suggestions send a prompt into a linked Chat, and dismissal survives reload until the Plan
  changes.
- Desktop, tablet and phone layouts pass in English and Chinese without horizontal overflow.

## Sources

The repository owner supplied the current Trip home and Mindtrip reference screenshots and approved
the design decisions on 2026-10-29. No Mindtrip code, copy or assets are reused. The decision record
is [Trip home actions stay in place](../../.agents/notes/implemented/feature/2026-10-29-trip-home-actions.md).
