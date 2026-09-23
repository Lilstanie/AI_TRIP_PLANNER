# Workspace UI

The web app (`apps/web`) is a single-user planning workspace. This document describes how it behaves
now. Implementation history and browser acceptance for each phase are in the
[session logs](../.agents/session-logs/README.md).

## Layout

| Area                    | Content                                                                                                                        | Implementation                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Sidebar                 | Logo, New chat, search, Chats and Trips history with counts, Saved trips, Language, Local account                              | `WorkspaceSidebar`, `BrandMark`, `icons.tsx` |
| Top bar                 | Destination with days, travellers and budget (real plan values only); Preferences; Trip with pending-decision count, rightmost | `Workspace`                                  |
| Chat                    | Conversation, the planning transcript, the composer; starter suggestions in a blank chat                                       | `ChatPanel`                                  |
| Map                     | Only the map, numbered markers, a place list, map status, View all places and Show my location                                 | `TripMapCanvas`, `TripMap`                   |
| Your Trip drawer        | Budget; Overview (sections and the stay chosen); Timeline & routes (editor); Review plan and Save trip                         | `Drawer`, `TripPanel`, `TripEditor`          |
| Trip Preferences drawer | Structured brief form: destination, dates, travellers, budget, nationality, accommodation                                      | `Drawer`, `FiltersPanel`                     |

- **Sidebar.**
  - Expands to 240 px (220 px below 1250 px) or collapses to a 64 px icon rail. The toggle uses
    `aria-expanded`, and the preference is saved in the catalog layout.
  - While expanded, a separator on its right edge resizes it between 200 and 420 px. Drag it, or focus
    it and use Left/Right (16 px steps), Home and End; double-click restores the responsive default.
    It is a `role="separator"` window splitter carrying `aria-valuenow`, and dragging writes
    `--sidebar-width` straight onto the workspace grid so the workspace does not re-render on every
    pointer move. A click that does not move the pointer leaves the responsive default alone.
  - The width is stored in the catalog layout only once the user resizes. Until then the stylesheet's
    responsive default applies, so narrowing the window still narrows the sidebar. Collapsing keeps
    the width for the next expand.
  - Collapsed icons keep `aria-label`, a tooltip and focus styles. Search, Chats and Trips expand the
    sidebar.
  - The current section is shown by background, bold text, a filled icon and a bar, plus
    `aria-current`. History supports search and select.
  - Each conversation has an overflow trigger at its top right that opens Rename and Delete, so those
    actions stay off the row until they are wanted. It is revealed on hover and on keyboard focus,
    and always shown where there is no hover to reveal it. The menu is a `role="menu"` of
    `role="menuitem"` buttons with `aria-haspopup` and `aria-expanded` on the trigger; Escape closes
    it and returns focus to the trigger without closing an enclosing drawer, and clicking outside or
    tabbing away closes it. Trips have no overflow menu because they have neither action.
  - The logo is `apps/web/public/brand/ai-trip-planner-logo.svg`, referenced by URL. Its alt text is
    empty next to the product name and “AI Trip Planner” when shown alone.
- **Drawers.**
  - Preferences, Your Trip and the narrow-screen navigation are overlay drawers below the top bar.
    They never cover the logo or top-bar buttons, and the chat and map keep their width.
  - `Drawer` provides `role="dialog"`, `aria-modal`, `aria-hidden` and `inert` when closed, focus on
    the close button, a Tab loop, Escape (nested edit previews and native dialogs first) and focus
    return to the trigger.
  - Only one drawer is open at a time. Closed drawers are translated fully outside the viewport, and
    the shell uses `overflow: clip` so they cannot be scrolled into view.
  - The Trip drawer is `min(max(62vw, 560px), 100% - 24px)` wide. Animations are 240 ms and respect
    `prefers-reduced-motion`.
- **Narrow screens (≤1000 px).**
  - The top bar keeps the menu, summary, Preferences and Trip on one row, with a Chat/Map switch below.
  - Navigation opens as a drawer, and Preferences and Trip span the content width.
  - At ≤520 px the top-bar buttons show icons only but keep their accessible names.

## Conversations, trips and storage

- **Start state.**
  - The page always opens on a blank planning entry and never loads a demo plan or reopens the last
    trip.
  - An unfinished blank chat (form and input) is continued. Otherwise an untouched blank chat is
    reused, so refreshing does not add empty chats.
  - Saved chats and trips open only when chosen from the sidebar or Saved trips.
- **New chat** creates an independent conversation with an empty form, input and map. It reuses an
  untouched blank chat when one exists, so pressing New chat repeatedly or after a refresh keeps a
  single empty conversation instead of stacking blank history entries. A conversation holding
  anything the user typed is never reused, and a renamed one keeps its name. A trip record is
  created and linked (`tripId`) only when a plan is produced; the chat title then becomes the
  destination and dates.
- **Starting to plan.**
  - A blank chat offers example trip suggestions. Selecting one replaces and focuses the message input;
    it never sends a message or starts a request.
  - Each agent reply renders under its own Think fold: the transcript streams at the foot of the chat
    while the turn runs, then moves above the reply that ended the turn and stays with it (including
    after a reload).
  - Planning progress is a deep-dive transcript, not a status list: `Think` (the turn) nests
    `Subagent · <name>` rows per round, which in turn nest that specialist's reasoning and tool
    rows, each with a DSH-style disclosure — a leading icon that crossfades to a chevron on hover or
    while open, and no trailing chevron. Every row starts collapsed, busy or settled alike, and a
    click opens only that row; there is no expand-all control. The Think row's own collapsed summary
    is the turn's count line (`N tool calls · M subagents · K rounds`); while busy it instead follows
    the newest streaming reasoning line or the live tool/subagent line. A tool row opens to the
    result's own rows, each with a category glyph (a fork and knife, a bed, a plane, and so on) drawn
    from the result's own kind, or the site's own icon when the provider returned that row's web
    page. The call's arguments read as one line, such as `Sydney Airport → The Rocks · 2026-11-10`. Reasoning deltas from one model call merge into a single row rather
    than arriving as separate fragments. A round above 1 is shown only with the coordinator's own
    explanation of what it revised. The surface it imitates, and the reasoning behind each
    divergence, are recorded in the [DSH thinking UI reference](design/dsh-thinking-ui.md).
  - Exactly one `Deep diving` line is the surface's only live region; it grows an elapsed clock after
    15 seconds.
  - Most of the time the planner still asks in plain prose: when it cannot proceed on a missing
    destination, dates, travellers or budget, it says so in one sentence and the traveller answers by
    typing, with nothing borrowed. For a genuine ambiguity with 2–4 concrete choices, the coordinator
    can instead ask a structured question: a card takes the composer's seat with the question, an
    optional recommended choice, and (for more than one question) a pager. Submitting sends the
    answers as the traveller's next message; closing the card returns the plain composer, and the
    question text stays visible in the assistant's own message either way. There is still no
    "apply the traveller's decision" feature for a plan choice a specialist already made — a
    structured question is only ever about planning input, never an approval — so a traveller who
    wants the plan itself changed still says so in chat or edits the trip. See
    [DSH thinking UI §3.2](design/dsh-thinking-ui.md#32-asking-the-traveller) and the
    [ask-user Agent Note](../.agents/notes/implemented/feature/2026-09-23-ask-user-question.md).
  - The chat has no calendar pop-up: dates can be typed in the composer. The calendar picker still
    exists in Trip preferences, where the traveller asks for it.
  - Messages retain their conversation order in a `role="log"`; each has one visible, spoken-once
    speaker label (You or Travel planning assistant). The traveller's own message is a right-aligned
    bubble; the assistant's reply renders full-width with no border or background, as Markdown
    (paragraphs, lists, bold, links opening in a new tab). Both carry a small clock underneath, in
    `HH:mm` for today and a short date otherwise, and long URLs or mixed Chinese/English text wrap
    within the chat column.
  - The composer is one card at the foot of the chat: a draft that grows with its content and then
    scrolls, an upload control on the left, and one primary action on the right. The card is
    `--surface-2` (white on light, grey on dark) so it reads as an input capsule laid on the page,
    and clicking anywhere in it highlights the card once — the field draws no ring of its own. Enter
    sends and Shift+Enter breaks the line, but never while an input method is composing. While a
    request runs, the primary action becomes Stop in place; there is no hint text.
  - Submitting Preferences sends `mode: "plan"` with the brief.
  - A first chat message sends `mode: "start"`, and the server reports any missing destination,
    dates, travellers or budget instead of borrowing values.
  - The blank form's minimum rating defaults to `0` (no minimum).
- **Requests.**
  - `Workspace` owns chat, plan and decision requests. Failures keep the current plan and offer retry.
  - Switching chat or trip, or New chat, first flushes the pending autosave, then aborts in-flight
    requests and clears progress, errors, selection and map routes. Late responses are ignored.
- **Storage.**
  - Everything is saved in the browser only, with a debounced autosave state in the sidebar.
  - The catalog (`trip-workspace-catalog-v3`) keeps conversations and trips separately, with stable
    links and an optional conversation `draft`. Legacy version 1 and 2 snapshots are migrated.
  - Layout stores the sidebar's `collapsed` always and its `width` only after a resize, so an
    untouched workspace keeps following the stylesheet at every viewport size.
  - Corrupt data is never overwritten automatically, and layout fields fall back to defaults instead
    of making history unreadable.
  - When storage is full or unavailable, the plan stays in memory with a visible retry.
  - Saved trips are independent snapshots, and “Restore last workspace” lives in the Saved trips
    dialog.

## Reviewing a plan

Names of removed surfaces below appear only to explain their removal; nothing in this section
describes current behaviour except the absences.

- **There are no decisions to approve.** `HitlCheckpoint`, `TripPlan.hitl`, the checkpoint cards, the
  approve/reject/defer actions and `POST /api/hitl` are all removed. The app cannot apply a
  traveller's decision yet, so it does not ask for one: presenting a list of things to confirm would
  offer a capability that does not exist.
- **What the plan does decide is reported, not asked.** The accommodation specialist compares every
  eligible candidate and names one; the transcript shows that choice with the alternatives it
  compared, and the Trip drawer shows the sections and their cost. A traveller who wants something
  different says so in chat, or edits the trip in Timeline & routes.
- **Conflicts are information.** When the orchestrator detects a conflict it retries the affected
  sections within its round budget, and anything still unresolved stays visible on the plan rather
  than becoming a card that waits for an acknowledgement nothing can record.
- The client is not a source of supplier facts: totals are recomputed from proposal items, and
  results are labelled as SerpApi live search, Google Places estimates or simulated fixtures. None
  of them creates a reservation.

## Map and places

- **Place lookups** (`components/map/useTripPlaces`, `lib/map/place-query.ts`):
  - A lookup uses, in order, a saved `placeId`, the activity's `location`, or a title that is itself a
    place name.
  - Descriptive activity text and mock placeholders (“Mock attraction near …”) are never sent to
    Places, and nothing is invented.
  - Destination cities (split on `&`) are looked up separately for framing.
  - Results are applied one by one and stay in memory; provider details and coordinates are not
    persisted.
- **Failure handling.**
  - Activities without a usable name or a Google match are “no confirmed place yet”; the timeline
    shows “Location to be confirmed”.
  - Rate limits, timeouts and outages are retryable, and Retry places repeats only those lookups.
  - The map shows a compact status; located markers stay visible and there is no blocking error.
- **Framing** (`lib/map/map-view.ts`):
  - The map frames the destination first: zoom 12 for one city, or bounds capped at zoom 12 for
    several, widened as cities resolve.
  - Once markers exist it fits them once, capped at zoom 15 (zoom 14 for a single place).
  - It reframes only on a trip or destination change or View all places. Drag, zoom and Show my
    location count as user moves and are never taken back.
  - No Google map is created before there is somewhere to show; a neutral placeholder is shown
    instead. Container resizes keep the centre.
- **Place preview.** The selected place is previewed above the place list with its first Google
  photo, address, the photo's author attribution and an Open in Google Maps link. Photos load only
  in live data mode with a server Maps key, one image per selection. Otherwise, and when Google has
  no photo or the image fails, the fixed 16:9 slot shows a pin.
- **Selection.** Selecting a marker or list item selects the activity in the timeline and jumps to its
  day, and the reverse also works. Selected markers add a larger outlined shape, while selected place-list
  buttons add a leading inset line and weight alongside `aria-pressed`; color is not the sole cue.
- **Trip drawer.** The reading order is heading and summary, budget, sections, then expanded detail.
  Missing or zero budgets state that no budget is set; invalid totals never render `NaN`, a negative bar,
  or a bar wider than its container.
- **Location.** Show my location runs only on request and handles denied, unavailable, timeout and
  unsupported cases. The position stays in component memory and is never saved or written into the
  plan. Route from my location requests a verified duration and distance for the selected place.
- **Controls.** Google's map-type, Street View and fullscreen controls are disabled so the map stays
  below the top bar.

## Timeline editing

The Timeline & routes tab edits activities through `POST /api/trip/preview-edit`. Previews are
deterministic and make no LLM calls.

- Activities receive stable IDs once, retained on reorder and restore. `editVersion` is independent of
  the orchestrator round, and a preview applies only if its base version still matches.
- Moves, time changes and place replacements preserve activity duration. Following activities start
  at the later of their original start or previous end + route duration + 15 minutes. Empty target
  days start at 09:00 local, and moves stay within the same lodging destination segment.
- An unknown route blocks automatic shifting (users can adjust time or mode). Overflow beyond the day
  blocks apply. Fixed transport and stays are read-only, and overlaps stay visible in review.
- Replacing a place marks the activity price for verification. Route fares are separate estimates,
  never added to transport twice, and an unknown fare is not zero.
- Edits invalidate itinerary and final confirmation and regenerate conflicts, keeping unaffected brief
  and hotel decisions. Undo revalidates instead of restoring old approvals. Chat replanning replaces
  manual activities.
- Routes use real local departure times from the Google Time Zone API; ambiguous or nonexistent DST
  times are rejected. Transit queries respect Google's supported departure window.

## Google Maps configuration

| Variable                          | Used by                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| `MAPS_API_KEY`                    | Server: Places search and details, Routes, Time Zone                      |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser: Maps JavaScript API                                              |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`  | Browser: vector map ID for advanced markers (falls back to `DEMO_MAP_ID`) |

Restrict the browser key by HTTP referrer and the server key by API. Map loading never delays the
first render; without a browser key the map shows a fallback and the itinerary stays usable.

## Out of scope

Booking fulfilment, payments, multi-user collaboration and on-trip mode remain out of scope. Mock
places and bookings must never be presented as real supplier data; live search and estimated prices
must retain their provider and freshness labels.

## Visual verification matrix

Use this checklist for each visual change. It supplements, and does not change, the layout and drawer behavior described above.

| Dimension       | Required checks                                                                      |
| --------------- | ------------------------------------------------------------------------------------ |
| Viewports       | 1600×900, near the 1000 px responsive boundary, and 375×812                          |
| Theme           | Light and dark at each relevant viewport                                             |
| Motion          | Default and `prefers-reduced-motion: reduce`                                         |
| Input           | Mouse and full keyboard navigation, including visible focus                          |
| Workspace       | Sidebar resize/collapse, Chat/Map switch, and no horizontal overflow                 |
| Drawers         | Navigation, Preferences, and Trip drawers; close, Escape, and focus return           |
| Content         | Empty chat/map, planning and failure states, long messages, and available map places |
| Native controls | Date, select, checkbox, and scrollbar follow the active color scheme                 |

Keep light and dark screenshots for desktop (1600×900) and narrow (375×812) acceptance. Verify body and supporting text contrast with a contrast tool; status must retain a textual or graphical cue when color is unavailable.

The root layout loads the self-hosted Fraunces display font through `next/font`; it is limited to destination, Trip, and empty-state headings. Body copy and controls retain the system sans stack, with serif fallbacks for display headings. `color-scheme: light dark` keeps native controls aligned with the active theme.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` must pass. Component tests cover drawers,
blank start, history restore, sidebar collapse, place lookup failures, request races and storage
recovery; `lib/map/map-view.test.ts` and `lib/map/place-query.test.ts` cover framing and lookup rules. Live
Google checks are reported separately in session logs and are never inferred from mocks. The
historical P0–P3 plan is in [`.agents/archive/p3-implementation.md`](../.agents/archive/p3-implementation.md) and the
session logs.
