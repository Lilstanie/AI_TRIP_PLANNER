# Workspace UI

English | [中文](workspace-ui.zh.md)

The web app (`apps/web`) is a single-user planning workspace. This document describes how it behaves
now. Implementation history and browser acceptance for each phase are in the
[session logs](../.agents/session-logs/README.md).

## Layout

| Area              | Content                                                                                                                                                                                                                                                                                                                                    | Implementation                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Sidebar           | Logo, New trip, Chats, Trips, Calendar, save or sync status, Settings & account                                                                                                                                                                                                                                                            | `WorkspaceSidebar`, `BrandMark`, `icons.tsx`                                                                            |
| Chats panel       | Slides out beside the sidebar: search, then trips and chats                                                                                                                                                                                                                                                                                | `ChatsPanel`, `TripCover`                                                                                               |
| Your trips        | Opened by Trips in place of chat and map: trip cards (Upcoming, Past) and a Calendar tab; New trip                                                                                                                                                                                                                                         | `TripsPage`, `TripCover`                                                                                                |
| Trip home         | Opened by choosing a trip card, a calendar band or a trip in the Chats search: trip title, back button, Rename and Delete menu, one line of tags from the plan's brief, the trip's chats and a box for a new chat, the trip map                                                                                                            | `TripHome`, `TripHomeChats`, `TripHomeMap`, `TripsPage`, `WorkspaceView`                                                |
| Top bar           | Desktop: Conversation \| Trajectory and Agent Team on the left; Brief chips only after the traveller has started; data mode on the right; Trip only with a Plan. Language only in Settings.                                                                                                                                                | `WorkspaceView`, `TripFactChips`, `TeamControl`, `ChatViewTabs`, `PhoneTeamButton`                                      |
| Trip fact editors | One editor per chip, every one a centred dialog; Preferences holds the traveller's own list                                                                                                                                                                                                                                                | `FactPopover`, `FactFields`, `TripCalendar`, `WhereFields`, `PreferenceList`, `lib/workspace/trip-facts.ts`             |
| Chat              | Conversation or Trajectory, the planning transcript, the composer; suggestion chips beside the composer on a blank untouched chat; rotating placeholders while focused and empty                                                                                                                                                           | `ChatPanel`                                                                                                             |
| Map               | Only the map, labelled markers, curved day-coloured itinerary lines, the place popup, map status, and the locate / map type / zoom controls                                                                                                                                                                                                | `TripMapCanvas`, `TripMap`                                                                                              |
| Trip workspace    | Dedicated itinerary and linked map on desktop; itinerary/map switch on tablet; the existing Trip tab on phones. Itinerary opens on a one-line budget summary (breakdown on demand), then an "N ideas" chip, day strip, selected-day stops and bookings, and Travel tips folded at the bottom; every expand/collapse uses one shared motion | `WorkspaceView`, `TripEditor`, `TripPanel`, `TripTips`, `TripMapCanvas`, `timeline/TimelineStop`, `timeline/BookingRow` |

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
  - The sidebar holds only navigation: New trip, Chats with a count,
    Trips with a count, and Calendar, in outline line icons in the text colour that fill in for the
    open panel or page, which also gets a heavier label, a quiet background and `aria-current`. New trip
    runs the same action as the Your trips page button and opens the Where editor on a blank trip. Calendar
    opens the Your trips page on its Calendar tab and is the current entry there; Trips is current on
    the Trips tab, and the page tabs and the sidebar share one selection. Collapsed, they are labelled
    icon buttons with tooltips. New trip is the one way to start a conversation from the sidebar;
    the [sidebar entries Agent Note](../.agents/notes/implemented/feature/2026-10-27-sidebar-entries.md)
    and the [no Chats plus Agent Note](../.agents/notes/implemented/simplification/2026-10-28-sidebar-without-chats-plus.md) record why.
  - **Chats** toggles the Chats panel (`aria-expanded`, `aria-controls="chats-panel"`): a 320 px
    glass region at the sidebar's right edge that springs and fades in over the workspace in 380 ms
    (instant under `prefers-reduced-motion`) and is `inert` while closed. Opening it focuses its
    search; Escape closes it and returns focus to Chats (an open history menu or dialog takes Escape
    first), and a press outside it closes it. The [Chats panel and Your trips Agent Note](../.agents/notes/implemented/feature/2026-09-24-chats-panel-and-trips-page.md)
    records why.
  - The panel has, from the top: a pill search field ("Search…", the visually hidden label "Search
    chats and trips" and a Clear search button that returns focus to the field), which filters both
    lists; New chat (pencil icon) and New trip (suitcase with a plus); **Trips**, each row a small
    destination cover and "Trip to <destination>"; and **Chats**, each row its localized short-date
    title on one line with the linked trip's name under it. Renamed chat titles are preserved.
    Choosing any of them closes the panel. See
    [New chat and New trip](#conversations-trips-and-storage) for what the two starts do.
  - Search splits whitespace-separated terms and requires every term to match across a chat's title
    or messages, or a trip's stored title, destination, ISO dates and the text its row shows (the
    numbered title, date range, days and total); term order does not matter. A number matches only a
    whole number, so `trip 2` picks out "Trip to Sydney · 2". Phone trip
    cards keep the numbering of the full list while filtered.
  - Search announces matching trip and chat counts through polite live regions. English uses singular for one result and plural for multiple results; Chinese uses the same counting phrase. Empty searches stay silent, and no matches announce the existing empty message.
  - **Trips** replaces the top bar, chat and map with the Your trips page: a "Your trips" heading, a
    New trip button, and Trips and Calendar tabs (`role="tablist"`, arrow keys switch) drawn as a
    segmented control whose thumb slides between them. Trips shows
    every trip as a 4:3 cover card with "Trip to <destination>" and "<destination> · <localized date range> · N days",
    grouped into Upcoming and Past. Calendar is a Monday-first month grid with previous, Today and
    next, drawing each trip as a band over its days, filled with the dark colour of its cover palette
    so the white label stays readable, labelled where it starts and at each week's start, with the label running across that week's days of the bar and ending in an ellipsis only if it still does not fit; it opens on the next trip's month. Calendar labels and accessible names reuse the Trips card disambiguation for trips with the same destination, dates, group size and budget; compact phone bars show a contrasting short destination prefix and ordinal (for example, `Syd·1`) so duplicate trips stay visibly identifiable. Each trip band announces its full title and inclusive start and end dates using the same full localized weekday, date and year format as the date cells, with UTC keeping calendar dates stable across time zones. Each date cell has a full localized weekday, date and year name; today has `aria-current="date"`; arrow keys move visible focus across every date, including empty dates. Choosing a trip, a chat, New chat or New trip returns
    to the workspace.
  - **Trip home** is a page of its own between the Trips page and the conversation. Choosing a trip card,
    a trip band on the calendar or a trip in the Chats search opens it (`layout` page `home`, carrying the
    trip id); opening a chat from Chats still opens the conversation. On a phone a trip card in Mine, or a
    calendar band there, opens the Trip home too, without the tab bar; Back returns to Mine on the tab it
    came from, and the Calendar card opens Mine on its Calendar tab at the trip's month. The heading is the trip's title as the Trips cards show it, so two identical trips
    read `Trip to Sydney · 1` and `· 2`. A back button named "Back to trips" returns to the Trips page on the tab
    the trip was opened from. The menu next to the title reuses the Trips page's Rename and Delete; Delete
    returns to Trips, where the existing Undo notice restores the trip and its chats. A trip deleted
    while its page is open, from any list, also returns to Trips. One line of tags, a labelled list, shows
    the brief's destination, dates (or the number of days when the dates do not read as a range), travellers
    and budget in the trip's currency, and leaves out any that is empty. Under the tags, `TripHomeChats`
    lists the trip's chats under a "Chats" heading, newest first by last update (chats saved in the same
    millisecond list the one started last first), each row a button with
    the chat title and its date in the interface language. Choosing a row opens that chat in the
    conversation view with the trip's latest saved plan: when the chat's own snapshot is older than the trip's,
    the trip's plan is shown and kept, so opening an older chat never downgrades the trip, and only an edit
    changes it. Below the list a box named "New chat" and a "Start chat" button start a new chat on
    the trip: the chat keeps the trip's plan, becomes the active chat, and carries any typed text into the
    composer without sending it. A trip with no chats shows only the box, and an empty box still starts a
    chat; an empty box reuses the trip's untouched empty chat instead of storing another. Starting a chat while the assistant answers on another chat stops that answer, as opening any
    chat does. Three entry cards sit under the chats (`TripHomeCards`): Itinerary with the number of
    scheduled stops, which selects the trip and opens the conversation view with the Trip panel on its
    itinerary; Calendar, which opens the Trips page on the Calendar tab at the month the trip starts, even
    for a past trip; and Preferences with the number of preferences set on the trip, which selects the trip
    and opens the Preferences panel. A count of zero is left out, the cards read the trip's own saved plan
    and draft rather than the open conversation, and there is no card for Ideas, Bookings, Media or Receipts.
    The cards stack in one column below 640 px. The page keeps a main column and an optional side column. The side column holds the trip map (`TripHomeMap`): the existing `TripMapCanvas` fed by
    the stops of the trip whose page is open, not of the active conversation, so its markers and its
    controls are the workspace map's and it adds none; its region is named "Trip map" (行程地图). Two
    columns show from 821 px up; at 820 px and below the map stacks under the content, 60% of the
    viewport tall up to 420 px, giving header, tags, content, map in one column on a phone. A trip whose
    places cannot be found keeps the map's own notice instead of markers. The [Trip home Agent Note](../.agents/notes/implemented/feature/2026-10-28-trip-home-shell.md)
    records why; `trip-home-shell`, `trip-home-chats`, `trip-home-cards`, `trip-home-map`, `trip-home-older-chat` and
    `trip-home-walkthrough` are its E2Es.
  - Trips keep no photos, so a cover is a gradient chosen by hashing the destination, with its
    initial; the same destination always gets the same colours.
  - A chat row's second line names its trip with the same title the Trips list uses, so two chats for
    trips with the same destination, dates, group size and budget read `Trip to Sydney · 1` and
    `· 2` there too. The row's overflow trigger is named `Actions for {chat}, {trip}` through the
    locale, so Chinese reads `{chat}，{trip}的操作`.
  - A chat row's overflow trigger at its top right opens Rename and Delete, so those
    actions stay off the row until they are wanted. It is revealed on hover and on keyboard focus,
    and always shown where there is no hover to reveal it. The menu is a `role="menu"` of
    `role="menuitem"` buttons with `aria-haspopup` and `aria-expanded` on the trigger; Escape closes
    it and returns focus to the trigger without closing an enclosing panel or drawer, and clicking
    outside or tabbing away closes it. Opening a chat menu scrolls the full menu into its containing panel before focusing its first action, keeping both actions above the phone tab bar.
  - Trip rows in the Trips list and trip cards on the Trips page and the phone Mine tab have the same
    Rename and Delete menu; on a card the trigger sits in the top-right corner and is always shown.
    Rename asks for a name; an empty name or Cancel keeps the current one. A renamed trip shows its
    name in the Trips list, on its card, on calendar bars and in the top title, and keeps it when the
    trip is replanned from chat or the page reloads. Delete removes the trip at once and keeps its
    chats, without their plan; a status line offers Undo, which brings the trip back with its name and
    chat links. Deleting the open trip starts a blank chat.
  - On narrow screens the navigation drawer shows the sidebar without a Chats row,
    and the panel's content (search, Trips and Chats) under Trips.
  - The logo is `apps/web/public/brand/ai-trip-planner-logo.svg`, referenced by URL. Its alt text is
    empty next to the product name and “AI Trip Planner” when shown alone.
  - The footer keeps the save status above a full-width profile row, with an avatar, two lines
    of identity information and an overflow button at the end.
- **Trip facts.** The brief is edited one fact at a time from chips in the top bar, following
  Mindtrip's trip bar; the [preference chips Agent Note](../.agents/notes/implemented/feature/2026-09-24-preference-chips.md) records why.
  - The chips read the preferences draft, so they show only what the traveller stated: a value
    ("Sydney", "1 Oct – 4 Oct · 4 days", "2 adults, 1 child", "AUD 2,000"), or the bare fact name —
    "Where", "When", "Who" and "Budget" — while it is missing. The budget uses the trip's
    effective currency (below). The chips form a `role="group"` named Trip
    details; a filled chip's accessible name leads with its fact ("Destination: Sydney").
  - When the chips do not fit the top bar, the row scrolls sideways: a vertical mouse wheel over it
    scrolls it horizontally, and a 56 px fade marks each edge with more chips behind it. A wheel
    elsewhere, or over a row with nothing hidden, scrolls the page as usual.
  - Each chip is a button with `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls`, and
    opens its own editor: Where (destinations and departing from), When (a full inline calendar), Who
    (a stepper per traveller kind), Budget (preset range cards plus a custom amount) and Trip
    preferences (the traveller's own list).
  - Every editor opens as a centred modal dialog (`aria-modal="true"`) over a scrim, like Mindtrip's,
    held a fixed distance from the top so a new row grows it downwards. The panel has no padding of
    its own: the head has the close button leading and a centred 20 px semibold title, content is
    inset by `--space-5`, and one Apple-blue pill at the bottom right (`--accent-fill` fill,
    `--on-accent` label, 168 × 40) is the primary action: Save, Done on Trip preferences, or Update
    trip once a plan exists. Trip preferences has a hairline under its head; the others have none. The
    panel is 512 px wide, 420 px for Who and Budget's shorter rows, and 680 px for When's two-month
    calendar (all `min(…, 100vw - 2 × --space-4)`). It is a Liquid Glass sheet with 28 px corners that
    springs in and sinks out (200 ms, kept mounted by `usePresence`), and the list rows use
    `--radius` (12 px).
  - Where lists the destinations in visiting order as cards: a 48 px square icon slot on
    `--surface-2` where Mindtrip shows a photo (no photo is fetched here), the name in 15 px semibold,
    the region line under it when the place was picked from a suggestion, and a 28 px round remove
    button. They are stored as one string joined with " & ". Below the list, an Add destination pill
    turns into a full-width pill search field with a clear button inside. Enter adds what was typed
    ("Sydney & Melbourne" adds two, a repeat is skipped), and text left in the field is kept on
    Save. In live data mode with Maps configured the field is a combobox that suggests places from
    `/api/places/search` after 3 characters and 350 ms without typing, each query asked once per
    editor, with the typed part of each name in bold; in mock mode nothing is looked up. Escape
    closes the suggestions first, then folds the field back into its pill (dropping what was typed),
    and only then closes the editor.
  - Departing from has no counterpart in Mindtrip's dialog but feeds transport planning, so it stays
    as a secondary section below the destinations: a small dim label and the same pill field, with
    a hint that leaving it blank skips long-haul flights. A card like a destination's was rejected
    because it would read as another stop. Mindtrip's road-trip switch is left out, because the
    planner has no road-trip mode.
  - When shows a full inline calendar (`react-day-picker`, `mode="range"`), two months side by side on
    desktop and one on phones, styled onto the design tokens: rounded day cells, a soft accent band
    across the picked range, solid accent circles at its start and end, today outlined, and month
    navigation in the header. Past dates are disabled. A summary line above it reads "1 Oct – 4 Oct ·
    4 days" (or a prompt to choose dates while none are picked), with a Clear action beside it once a
    date is picked. When dates exist, it opens on their start month; an undated trip opens on the
    current month. `DateRangePicker` (a calendar in its own dialog, used nowhere else at the moment)
    shares the same styled calendar component (`TripCalendar`) so the two never drift apart.
  - Who is a stepper (− count +) per traveller kind: Adults (13–64), Children (2–12), Infants (under
    2), Seniors (65+) and Pets, each with its own remove/add buttons and a live count (a `role="status"` region, so a screen reader announces "Adults: 2" after + or −). The draft keeps
    this breakdown (`Draft.party`) and keeps `groupSize` in sync as `adults + children + infants +
seniors` (pets are never counted as travellers) on every change; `groupSize` stays the validated
    field, so at least one person is required; a breakdown with children or infants but no adult or senior is rejected inline (children cannot travel alone) and the sheet stays open. Opening Who on a draft with no breakdown yet (saved
    before the steppers existed) starts every stated traveller counted as an adult.
  - The breakdown reaches the planner as `TripBrief.party` (and `known.party` before a plan exists),
    beside `groupSize`. Every specialist's shared rule asks it to plan for children, infants,
    seniors and pets where its evidence allows and to say when it cannot confirm suitability;
    `groupSize` is authoritative for people and all cost arithmetic. Chat derives it from a
    breakdown only when no total is already known or stated; when a known or stated total conflicts with a new
    breakdown, `groupSize` is preserved and both the new and previous breakdowns are dropped. A breakdown that no longer adds
    up to `groupSize` (say, the chat later learns "we're three now") is dropped rather than sent. The
    [traveller party Agent Note](../.agents/notes/implemented/architecture/2026-09-24-traveller-party.md)
    records the original decision; the
    [authoritative traveller count note](../.agents/notes/implemented/bug-fix/2026-10-20-authoritative-traveller-count.md)
    records chat extraction behavior.
  - Budget offers four preset cards in a `role="radiogroup"`: Budget (AUD 900), Moderate
    (AUD 3,000), Comfort (AUD 6,000) and Luxury (AUD 10,000). Each shows its amount in the
    trip's effective currency and is selected exactly while `budgetTotal` equals its AUD value.
    The custom amount field shows and accepts the trip's effective currency. The AUD 1,000,000 cap is stated in that currency, rounded down to a whole unit so the stated amount saves ("Enter a total budget of USD 666,666 or less."). Saving preserves the typed amount and currency in
    `budgetSource` and converts once with shared `toAud` into `budgetTotal`. Matching source
    currency displays the original amount rather than a round trip. Trip currency never changes
    Settings; a new trip uses Settings again. The trip's **effective currency** is one rule, `effectiveCurrency()` in `packages/shared/src/money.ts`, read by the locale provider (plan panel, chips, budget field), the trip cards and the trip list: `TripBrief.displayCurrency` (the last currency the traveller named for the trip, with a budget or on its own, such as "show it in yen" or "用人民币给我算"), otherwise `budgetSource.currency` (so a trip saved before the field existed reads as before), otherwise the Settings display currency. A later naming overrides an earlier one, including the budget's currency, and naming AUD sets AUD. `budgetSource` keeps the amount and currency as stated and is not rewritten when the display currency changes. Chatting in Chinese without naming a currency keeps the Settings currency. Settings changes reach only trips that never named a currency. Each card on the Your trips page ends with its trip's estimated total in that trip's own effective currency. Agents and guardrails still read AUD.
  - Trip preferences opens on a filled field (`--surface-2`, no border, 15 px) that adds a preference
    with Enter; below it each preference is a filled row with a remove button, up to 12 of up to 200
    characters. Clicking a preference's text edits it in place (Enter or leaving the field keeps it,
    Escape cancels only the edit); there is no pencil. Duplicates are refused with a message, text
    left in the field is kept on Done, and additions and removals are announced in a status region.
    Nationality, room allocation, minimum guest rating and free cancellation are no longer edited;
    a stored brief's values pass through unchanged, and a stored rating the schema would reject
    counts as "no minimum". The No accommodation checkbox records that no stay is needed; leaving it
    unchecked preserves normal accommodation planning, and it does not replace a separately recorded
    booked stay.
  - Below the list, "Learned from your chats" shows what the assistant recorded from the
    conversation, when there is anything:
    - each learned preference;
    - "Flights: arranged by you, not planned";
    - "Stay: <name>, booked by you".

    Each row can be removed but not edited. A removal takes effect on the next plan.

  - An editor is a labelled `role="dialog"`. Focus moves to its first field (Where with places
    already listed starts on Add destination), Tab loops inside it, and Escape, the close button or a
    saved edit return focus to the chip. A press outside the panel lands on the scrim and returns
    focus to the chip. Opening one closes the Trip workspace and the navigation drawer.
  - Edits stay in the editor until they are kept. On a phone, switching between Chat, Map, Trip and
    Mine keeps the unfinished values, while Escape, close, Cancel, outside dismissal and browser Back
    ask whether to continue editing or discard when the form changed. Desktop Escape and outside
    dismissal continue to discard. Each editor checks its own fields with the brief schema and shows
    how to fix one next to it.
  - Before there is a plan, Save keeps the edit in the draft; nothing is sent. The stated facts go
    with the next chat message as `known`, and Plan trip in Trip preferences plans with the whole
    brief (`mode: "plan"`). Once a plan exists the button says Replan trip: it keeps the edit and
    replans with the whole brief, because a chat message carries the plan's brief, not the draft. A
    rejected brief opens the editor of the first fact at fault, with the error beside the field.
  - The trip title stays in the top bar at 1250 px and wider. Below that the destination chip names
    the trip and the title is kept for assistive technology only.
- **Map on demand.** On desktop a chat with no plan shows the chat alone, centred at up to 880 px.
  When the first plan arrives the map slides in from the right over 420 ms and the chat narrows to
  the split below; a new chat slides it out again. The separator is hidden while the map is hidden.
  Tablet and phone layouts are unchanged.
- **Message actions.** Every message has a copy button under it (hover or focus on a pointer
  device, always visible on touch). A traveller's message without attachments also has an edit
  button: it turns the bubble into a text box. Resend asks before replacing manual timeline changes;
  cancelling keeps the editor text and chat history. After confirmation it removes that message and
  everything after it, then sends the new text. The trip plan itself is not rolled back. Text in messages and replies
  is selectable.
- **Chat and map split.** On desktop the chat is on the left at 56 % of the area by default, a
  little wider than the map. A separator between them (`role="separator"`, "Resize chat and map")
  moves it between 30 % and 75 %: drag it, or focus it and use Left/Right (2 % steps), Home and End;
  double-click restores the default. Its `aria-valuetext` ("Chat 56% of the width") is in the
  interface language. Dragging writes `--chat-share` straight onto the shell, and the layout stores
  `chatShare` only once it has moved.
- **Panels and Trip workspace.**
  - The navigation panel remains an overlay below the top bar. Opening a planned Trip on desktop
    (above 1000 px) switches the main area to a dedicated workspace: the itinerary timeline and its
    linked map sit side by side, while the chat is hidden. Selecting a stop or day keeps the map and
    timeline synchronized. The trip header stays available above both regions.
  - At tablet widths (521–1000 px), Trip uses a single content area with an Itinerary/Map switch;
    switching views retains the selected day and stop. At phone widths (≤520 px), the existing
    Chat/Map/Trip/Mine shell remains in control and Trip stays in its Trip tab.
  - When Trip is closed, the existing chat/map split and its resizer behave as described above.
    Opening Trip does not change the saved split.
  - `Drawer` provides `role="dialog"`, `aria-modal`, `aria-hidden` and `inert` when closed, focus on
    the close button, a Tab loop, Escape (nested edit previews and native dialogs first) and focus
    return to the trigger.
  - At most one panel is open at a time: a drawer (Trip, navigation or the desktop Chats panel), the
    phone Trip details sheet or one chip editor. Opening one closes the others; Settings
    opens on top of it and return to it when they close. One pure function, `layout()` in
    `apps/web/lib/workspace/layout.ts`, decides what is open; see the
    [layout Agent Note](../.agents/notes/implemented/architecture/2026-10-06-workspace-layout-reducer.md).
    A reload starts with every panel closed. Closed drawers are translated fully outside the
    viewport, and the shell uses `overflow: clip` so they cannot be scrolled into view.
  - Drawers are floating Liquid Glass sheets inset by `--space-2` with `--radius-xl` corners. They
    slide on the iOS sheet curve in 380 ms, and the backdrop fades out with them (kept mounted by
    `usePresence`). All of it respects `prefers-reduced-motion`.
  - Opening another chat or trip, New chat, New trip and the Your trips page cross-fade the main
    column through the View Transitions API (`viewTransition`); phone tab switches use the same transition helper.
    The column carries its `view-transition-name` only while a transition runs: a named element is
    a backdrop root, and a permanent name left the chat sharp behind the drawers' glass.
- **Narrow screens (521–1000 px).**
  - The top bar keeps the menu, the fact chips and Trip on one row, with a Chat/Map switch below.
    When the chips do not fit they scroll sideways inside their row, which fades at the edge that
    has more chips behind it; the page itself never scrolls sideways.
  - Navigation opens as a drawer, and Trip spans the content width. The navigation drawer has no
    title row: it opens on the sidebar's own logo row with the close button at its end, and the
    dialog keeps "Navigation" as its accessible name through a visually hidden heading
    (`Drawer`'s `hideTitle`).
- **Phones (≤520 px).** The [phone shell decision](../.agents/notes/implemented/feature/2026-10-05-phone-shell.md)
  applies only at this width; desktop and tablets keep their existing navigation.
  - A safe-area-aware bottom tab bar exposes Chat, Map, Trip and Mine as keyboard-operable tabs.
    Trip appears when a Plan exists; the empty workspace exposes Chat, Map and Mine. The Agent Team
    entry opens the phone Trajectory in a full-screen modal, preserving its ledger, search, filters
    and inspector, as described under Trajectory tab. Close, Escape or Browser Back returns to the
    originating view and focus.
    One panel is visible at a time; panels stay mounted to preserve their scroll position. The saved
    layout restores the last tab, including older Chat/Map choices.
  - The single-row top bar shows the destination and dates, or New trip. Its title opens Trip details:
    Where, When, Who, Budget and Preferences as rows. Each row opens the existing editor; saving or
    closing returns focus to the title. Brief edits are bottom sheets with 44 px targets; Stop
    edits open as a small popover on the row, never a sheet or page. The targets include each sheet's close
    button and primary action, every When day cell, both month arrows, Clear, and every Who − and +
    stepper button.
  - A changed Brief sheet keeps its values through tab switches and asks before Escape, close, outside
    dismissal or browser Back discards them. Stop popovers apply on submit and
    close without asking: Escape, Cancel, outside dismissal and Back drop what was typed, and nothing
    is kept as a draft or listed after navigation. A failed time or place change keeps the entered
    values and shows the error in place. Brief edits on a Trip with a Plan use the explicit Replan trip
    action. See the [instant itinerary edits Agent Note](../.agents/notes/implemented/feature/2026-10-27-instant-itinerary-edits.md).
  - Trip shows Your Trip in place, with Budget and the day view. Before
    planning it explains the empty state and offers Plan in Chat. A plan created or changed while
    another tab is selected adds an accessible update dot to Trip; opening Trip clears it. Read revisions are tracked per trip,
    so switching between unchanged saved trips does not create a new notification.
  - Map and Trip share one day and Stop for the active trip. Selecting a day or Stop in either view
    carries the exact visit to the other, including later visits to the same place. A revision keeps
    a valid day and Stop, clears a removed Stop, and moves a removed day to the nearest remaining day.
    Each saved trip restores its own browsing position when reopened.
  - A blank Chat shows at most two example prompts. Planning progress stays in Chat while the
    request runs. When the Plan is ready, Chat stays open and the reply adds an explicit Open trip
    action; opening it selects Trip. An initial failure restores the submitted text and shows an
    explicit Retry update action, while a failed revision leaves the previous Plan readable.
  - Mine places search first, then saved Trips as the primary collection and chats below. New trip
    sits with Trips, New chat with chats, and one Settings & account entry follows both collections.
    Search filters chats and trips; opening a saved trip selects Trip, while opening a recent chat or
    starting either selects Chat. Each chat has a visible Rename/Delete row menu on touch. Data mode
    and interface language live here; the data-mode button shows its text label in both languages.
    Opening a trip from Mine moves keyboard focus to the trip-title button, whose accessible name
    identifies the destination and dates.
  - Crossing the phone width keeps the traveller on the same thing: narrowing with Your trips open
    continues in Mine, so the tab bar stays available, and narrowing with the Trip workspace open shows
    the Trip tab. Widening from Mine shows Your trips, widening from Trip opens the dedicated Trip workspace over
    Chat (unless a chip editor is open), and Chat and Map stay as they are. Settings and chip
    editors stay open across the crossing; Trip details closes when the phone top bar goes away.
  - Map fills the space between the bars. Its day-stops sheet has collapsed, half and full heights,
    selected by dragging or using its handle with pointer or keyboard; the handle's name states the
    current height, so a screen reader hears each step. Changing day filters the map's
    markers and routes to that day's stops, so a place visited on several days appears on each of
    them with its trip-wide number; selecting a stop, in the sheet or on the map, focuses that day's
    visit. Each row leads with the stop's place name, as the Trip tab does, with its start time below;
    a stop that is not on the map has no number circle and says "Not found on the map" there instead.
    Without a Maps key the sheet and stops still
    work, while the map explains its unavailable state. Place details open in a bottom sheet; desktop
    keeps its popup. OSM markers stay beneath the phone details sheet, including after viewport changes.
    The 44 px map controls stay above the stops sheet, and panning does not scroll the page.
  - Map day chips, the Trip budget and Travel tips disclosure headers, the empty Trip tab's Plan in
    Chat and Add trip details buttons, and the Think row above a reply are at least 44 px tall.
    Disclosure headers keep their native markers and keyboard toggling. These target heights apply
    only at phone widths; sizing at 521 px and above stays unchanged.
  - With the composer focused and the visual viewport shortened by the keyboard, the shell follows
    that viewport, keeps the latest message visible and hides the tab bar. A focused trip-fact editor
    or stop editor field also hides the tab bar; the fact sheet rests on the keyboard, and the field
    and its Save button stay in view. Closing the keyboard or blurring restores it. Browser Back
    closes the active sheet or editor before leaving the workspace and, when its form changed, asks
    before discarding.
  - New labels use the English/Chinese dictionary and motion respects reduced-motion preferences.
    Browser evidence is produced by `phone-navigation.e2e.mjs` and the `phone-shell.e2e.mjs` companion
    walks under `apps/web/tests/e2e/`. Real installed-app safe areas and keyboard behavior are not
    verified; the device checks in issue #182 were closed as not planned.

## Conversations, trips and storage

- **Start state.**
  - The page always opens on a blank planning entry and never loads a demo plan or reopens the last
    trip.
  - An unfinished blank chat (form and input) is continued. Otherwise an untouched blank chat is
    reused, so refreshing does not add empty chats.
  - Saved chats and trips open only when chosen from the sidebar.
- **New chat** creates an independent conversation with an empty form, input and map. It reuses an
  untouched blank chat when one exists, so pressing New chat repeatedly or after a refresh keeps a
  single empty conversation instead of stacking blank history entries. A conversation holding
  anything the user typed is never reused, and a renamed one keeps its name. A trip record is
  created and linked (`tripId`) only when a plan is produced; the chat title then becomes the
  destination and dates.
- **New trip** starts the same blank conversation, named "New trip" (shown as 新行程 in Chinese, and the
  Chats row and its action label follow the interface language until the conversation is renamed), and opens the Where editor
  with focus on Destination instead of focusing the message input. It reuses an untouched blank
  conversation exactly as New chat does, and New chat renames that conversation back. The trip is
  listed under Trips once a plan is produced; until then it is a blank conversation under Chats. The
  [New trip Agent Note](../.agents/notes/archived/feature/2026-09-24-new-trip.md) records why.
- **Starting to plan.**
  - Verify progressive disclosure and Settings language changes with `pnpm --filter @trip/web e2e progressive-empty-workspace ui-language`. These journeys cover desktop and phone layouts in English and Chinese with local response fixtures; they do not establish live-provider planning. Phone facts are edited through the Trip details sheet, while desktop uses the Brief bar.
  - A blank untouched chat (no messages, no Plan, empty input, draft equal to Travel profile defaults) has no centre card. Outside the phone shell, a chat with no messages and no Plan keeps the composer near the vertical centre, Mindtrip-style; the first send glides it to the bottom (instantly under reduced motion). Example trip suggestions sit beside the composer; selecting one sends a prompt and starts planning. The Brief bar and Preferences stay hidden until the traveller types, changes the draft relative to Travel profile defaults, or already has messages; they hide again only when the chat returns to blank untouched. Trip stays hidden until a Plan exists. The composer placeholder rotates about every 4–5 seconds while focused and empty, preferring prompts for missing Brief facts, and settles to a revision prompt once a Plan exists.
    The prompt follows the interface language while keeping its dates, travellers and budget;
    data-mode tooltips and the action name for an untitled chat follow that language too.
    The browser title follows the active trip and the locale-formatted date range, and returns to
    `AI Trip Planner` when there is no active trip. Chinese short ranges retain 月 and 日 in date
    chips, automatic chat titles and trip summaries (for example, `12月3日 – 12月4日`); ranges
    outside the current year or across years include the year at both ends.
  - Each agent reply renders under its own Think fold: the transcript streams at the foot of the chat
    while the turn runs, then moves above the reply that ended the turn and stays with it (including
    after a reload). English specialist summaries, assumptions and progress lines count in the
    singular for one and the plural for more ("1 transport option", "2 rooms"), never with "(s)". So
    does the stay price detail ("1 room × 3 nights × AUD 230.00 per room/night").
  - **Agent Team** is a button in the desktop top-left beside Conversation | Trajectory (and left of Trip once a Plan exists). It is a compact capsule of
    three stacked avatars, working specialists first (a working one bobs), and, while planning, "N working".
    The six-row panel it opens is unchanged. When the usable top bar is at most 1280 px, it hides the label
    and shows the working count compactly; at most 920 px it reduces the avatar stack to one icon. The
    working count stays in its accessible name.
    Hovering it opens the team panel; Enter, Space or a touch pins it and moves focus into the panel; a click
    on the button while the panel is open, hovered or pinned, closes it, and so do Escape and a press
    outside. Escape returns focus to the button only when focus was inside the panel. The panel is a
    dialog named Specialist team, which the button controls through `aria-controls`; hovering alone does
    not move focus. The panel never opens by itself and
    updates live. It shows the latest turn: the live stream while one runs, otherwise the newest saved
    agent reply's activity. [`TeamPanel`](../apps/web/components/chat/TeamPanel.tsx) takes a `TeamModel`
    as input, so the live turn and a saved reply's run share it, and [`teamModel`](../apps/web/components/chat/team-model.ts) derives everything from the
    streamed events, nothing invented.
    At 520 px and below the top bar keeps one row: the same capsule (three stacked avatars, working first, and a compact count while planning), at least 44 px tall, sits right of the
    trip title, which truncates. It opens a full-screen Trajectory
    ([`PhoneTeamButton`](../apps/web/components/workspace/PhoneTeamButton.tsx)). The ledger fills the
    viewport, and a Specialist team fold keeps the same team cards, filters and focus navigation
    reachable above it. The modal owns focus while open; Close, Escape or Browser Back restores the
    originating Chat, Map, Trip or Mine view and returns focus to the button. It shares the layout
    `sheet` slot, so it never opens together with Trip details, and it closes when the viewport grows
    past phone width.
    - The panel body is DSH's Agent Teams layout ([`TeamPanel`](../apps/web/components/chat/TeamPanel.tsx),
      copied with its MIT header). **Members** (count 6) holds six cards, always, in the fixed order
      (Coordinator, Day plan, Getting around, Stay, Destination guide, Food & dining): icon, current name, a
      state dot with the status and the assistant's latest objective as a tag. Idle is before any event;
      Working is started with no result in the latest round; Done is completed; Failed is `agent_failed`;
      Needs change is named by the latest conflict check and not yet revised; Stopped is a turn that was
      cancelled or failed while the assistant was working (the Coordinator of such a turn is Stopped too);
      Not involved is no assignment this turn, and the card is greyed. The Coordinator card carries the
      Decided by AI or code marker for the dispatch.
    - **Assignments** (count) lists the turn's assignments and checks in event order as task cards. An
      assignment is a specialist's first dispatch, a targeted revision or a hand-off. Its card shows the
      owner, a state dot with the round status (Working, Done, Failed or Stopped), the objective clamped to
      two lines with Show more, the kind, a Decided by AI or Decided by code marker (AI when the stream
      carried that specialist's reasoning in that round, otherwise code once the turn ends; a hand-off
      carries its own provenance) and the data source (live, estimated, mock, fallback or unavailable).
      A misdirected mention is one hand-off card. Conflict checks name the specialist sent back with a
      Needs change tag; revision scores say kept or discarded; the stop reason ends the list. Checks are
      rules and carry no icon.
    - The Think fold's Subagent rows use the same icons. The Trip itinerary shows no assistant icons. The live
      area above the message box shows only the Think fold.
    - **Opening the filtered trajectory.** Pressing a card of an involved assistant (Working, Done, Failed,
      Needs change or Stopped; the card is a button called "Show {name} trajectory") closes the panel,
      switches to the chat when the Map is showing (the Map view at tablet width) and opens the Trajectory
      tab showing only that assistant's records: its messages, assignments and tool calls, and the
      conflict checks and revision scores that name it. A bar above the ledger names the assistant and
      its Show all records button clears the filter; the filter survives switching tabs until cleared and a
      second press replaces it. Idle and Not involved cards are disabled. On a phone, the same card
      closes the Specialist team fold and filters the already-open full-screen Trajectory without
      changing the underlying Chat, Map, Trip or Mine tab.
      The request is [`trajectory-focus.tsx`](../apps/web/components/chat/trajectory-focus.tsx), applied by
      `ChatPanel` on desktop and by `PhoneTrajectory` on a phone; the filter itself is `only` in
      `buildTrajectory`.
  - There is no row of assistant chips above the message box. Typing `@` at the start of a word opens a
    menu of the six assistants (the Coordinator and the five specialists), each with its icon and
    current name, filtered by what follows the `@` and matched against the current, role and custom
    names. A name of several words (Food & dining, or a custom name with spaces) keeps the menu open while
    the typed text is still the start of some name. The up and down arrows move, Tab or Enter picks and
    inserts `@<name> ` (Shift+Tab moves focus and picks nothing), and Esc closes the
    menu without changing the draft; a closed menu stays closed until the query changes or the caret
    moves to another token. The textarea keeps focus and names the active option through
    `aria-activedescendant`, and options are 44 px tall at phone width. Right after a whole `@name`,
    the first Backspace selects that token together with its trailing space and the second deletes both; any other key, click or
    caret move clears the selection. Neither the menu nor the token selection acts during IME
    composition. The message stays plain text. Typing a full `@name` with a default role name in
    English or Chinese resolves the same way. The client resolves each `@name` to a specialist id, drops duplicates, and sends
    `mentions` with the message; `@Coordinator` is not sent, because a message without a mention
    already goes to the Coordinator. With a plan, only the mentioned specialists run, revise their own
    sections, and the planning loop's conflict check and targeted revision follow. The reply carries the
    mentioned specialist's icon and name. Conflict, revision-score and stop messages from the loop show in
    the team panel as plain rules with no icon. With no plan yet, the mentioned
    specialist only answers, nothing is created, and the same message asks for the brief. A message may mention several specialists: each id is sent once,
    exactly those specialists run together in one round, only their sections change, and one conflict
    check follows once they have all finished. A mention that names the wrong specialist (for example Stay
    with a restaurant request) is handed off once: the mentioned specialist declines under its own icon and
    names the right specialist, the Coordinator dispatches, and only the receiving specialist answers and
    changes its section. The decline is marked as AI or code decided, and the text is localised.
  - Planning progress is a deep-dive transcript, not a status list: `Think` (the turn) nests
    `Subagent · <name>` rows per round, which in turn nest that specialist's reasoning and tool
    rows, each with a DSH-style disclosure — a leading icon that crossfades to a chevron on hover or
    while open, and no trailing chevron. Every row starts collapsed, busy or settled alike, and a
    click opens only that row; there is no expand-all control. The Think row's own collapsed summary
    is the turn's count line (`N tool calls · M subagents · K rounds`), with rounds counting actual
    work rounds. A turn with no counts reads
    Trip plan ready when it delivered a plan, Need more details when it ends by asking the traveller,
    Needs attention when it failed, and Done otherwise, including messages saved before the turn's
    outcome was recorded. While busy it instead follows
    the newest streaming reasoning line or the live tool/subagent line. A tool row opens to the
    result's own rows, each with a category glyph (a fork and knife, a bed, a plane, and so on) drawn
    from the result's own kind, or the site's own icon when the provider returned that row's web
    page. The call's arguments read as one line, such as `Sydney Airport → The Rocks · 2026-11-10`. Reasoning deltas from one model call merge into a single row rather
    than arriving as separate fragments. A round above 1 uses the coordinator's explanation when
    available, and otherwise falls back to its localized Round N label; duplicate round headings
    are omitted. A settled agent row without
    lifecycle events is marked Interrupted. The surface it imitates, and the reasoning behind each
    divergence, are recorded in the [DSH thinking UI reference](design/dsh-thinking-ui.md).
  - Exactly one `Deep diving` line is the surface's only live region; it grows an elapsed clock after
    15 seconds.
  - While a request runs, the Think row's icon is a 20 px `ThinkingOrb` from `thinking-orbs`
    (`components/chat/ThinkingOrbIcon.tsx`). Its animation follows the latest real progress event:
    planning weaves, a provider lookup searches, the conflict check solves, a revision works,
    assembly composes and a specialist's reasoning breathes. It is hidden from assistive technology
    because the row's text already says what is happening, draws one still frame under reduced
    motion, and gives way to the static icon when the turn ends. Each running Subagent row has its
    own orb from that specialist's latest step: a route check connects, another provider call
    searches, a revision works, its reasoning breathes.
  - Most of the time the planner still asks in plain prose: when it cannot proceed on a missing
    destination, dates, travellers or budget, it says so in one sentence and the traveller answers by
    typing, with nothing borrowed. For a genuine ambiguity with 2–4 concrete choices, the coordinator
    can instead ask a structured question: a card takes the composer's seat with the question, an
    optional recommended choice, and (for more than one question) a pager. At phone widths (520 px
    and narrower), Collapse, Dismiss all, Previous and Next have 44 × 44 px hit areas; the two header
    controls have a 12 px gap. Skip and Next/Submit are at least 44 px tall. The SVG icons and controls
    at larger widths keep their existing sizes. Submitting sends the
    answers as the traveller's next message; closing the card returns the plain composer, and the
    question text stays visible in the assistant's own message either way. An unanswered question
    survives reload and can still be answered after restoring the conversation. If submission fails,
    the submitted text returns to the composer unless the traveller has entered newer text. There is still no
    "apply the traveller's decision" feature for a plan choice a specialist already made — a
    structured question is only ever about planning input, never an approval — so a traveller who
    wants the plan itself changed still says so in chat or edits the trip. See
    [DSH thinking UI §3.2](design/dsh-thinking-ui.md#32-asking-the-traveller) and the
    [ask-user Agent Note](../.agents/notes/implemented/feature/2026-09-23-ask-user-question.md).
  - The chat has no calendar pop-up: dates can be typed in the composer. The calendar picker still
    exists in the When chip's editor, where the traveller asks for it.
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
  - Update trip in a chip editor, or Plan trip in Trip preferences before there is a plan, sends
    `mode: "plan"` with the brief.
  - When a chip edit changes only the budget, the user's chat message names that change alone and
    formats its amount with the trip's display currency and locale.
  - A first chat message sends `mode: "start"`, and the server reports any missing destination,
    dates, travellers or budget instead of borrowing values.
  - The blank form's minimum rating defaults to `0` (no minimum). Stay ratings are stored on a 0–10
    scale and shown out of 5 everywhere (hotel cards, stay rows, the thinking transcript); a place's
    Google rating is already out of 5 and shown as it is.
- **Requests.**
  - `Workspace` owns chat, plan and decision requests. Failures keep the current plan and offer retry.
  - A planning turn ends in one outcome: plan applied, needs information, planner asked a question,
    fares answered, failed or cancelled. `requestTurn` in `lib/workspace/session.ts` only sends the
    request and reads the stream; the pure `session(state, event)` there applies the outcome, so the
    reset rules (previous total, selected stop, map routes, field errors, question card) live in one
    place and are tested without React in `tests/lib/workspace/session.test.ts`. A pending question
    and its answer progress persist across reloads; while an answer is being sent, answer editing,
    paging, skip and submit are locked, and Stop aborts the request without discarding the question
    or its draft. A failed request leaves the question answerable for retry, a late response after
    Stop is ignored, and a successful reply clears the question.
  - Switching chat or trip, or New chat, first flushes the pending autosave, then aborts in-flight
    requests and clears progress, errors, selection and map routes in one `opened` session event.
    Late responses are ignored.
  - Applying an edit from the trip list or the timeline is `applyEdit(next)`, which records the
    previous total. A chat replan sets `estimateChange` to the signed change from the plan it replaced,
    and a timeline edit clears it. Views get these as actions from
    `useWorkspace`, never as state setters ([architecture](architecture.md#workspace-state)).
- **Storage.**
  - Everything is saved in the browser only, with a debounced autosave state in the sidebar.
    A catalog object already persisted by autosave is not serialized and written again by the catalog
    effect. Layout, history and account-sync changes still persist; a failed write remains retryable.
  - The catalog (`trip-workspace-catalog-v3`) keeps conversations and trips separately, with stable
    links and an optional conversation `draft`. The catalog writes version 5 and reads version 4,
    normalizing it to version 5; version 3 (AUD) snapshots remain readable and recover their budget
    source when the draft still matches the plan. Pre-AUD versions 1 and 2 remain rejected, and the
    storage keys stay unchanged.
  - Layout stores the sidebar's `collapsed` always and its `width` only after a resize, so an
    untouched workspace keeps following the stylesheet at every viewport size.
  - Corrupt data is never overwritten automatically, and layout fields fall back to defaults instead
    of making history unreadable.
  - When storage is full or unavailable, the plan stays in memory with a visible retry.
  - Every planned trip is kept in the catalog automatically, so there is no separate Save trip
    button or saved-snapshot list. Snapshots left under `trip-saved-v1` by the retired button are
    neither read nor deleted; see
    [workspace catalog trip storage](../.agents/notes/implemented/architecture/2026-09-24-workspace-catalog-trip-storage.md).

## Trajectory tab

The chosen chat view lives in the layout surface (`chatView`), not in the chat column. Pressing Conversation or Trajectory, or choosing a specialist in Agent Team, while the Trip panel is open dispatches `show-chat-view`, which closes the Trip panel and selects that view in one step; the Trip button opens the panel again and the chosen view stays underneath.

The Trajectory chrome uses the glass tokens on floating surfaces only: the Simple and Full view switch, the full view toolbar and the record inspector (`glass-float`, `glass-float--raised`, so reduced transparency and high contrast give the solid surface). Rows, the timeline and the ledger stay solid. Secondary text is the primary text colour mixed 74% into the surface, which keeps 4.5:1 on glass in light and dark. Data, search, jumps and the two views are unchanged. See the [Trajectory glass restyle note](../.agents/notes/implemented/feature/2026-10-28-trajectory-glass-restyle.md).

On desktop the chat column has a Conversation and a Trajectory tab. Conversation is the message stream
and stays mounted while Trajectory is open, so its scroll position returns; when a reply arrived meanwhile it returns at the newest reply. The chat column has no tab list at phone width.
On a phone, the Agent Team entry opens Trajectory (轨迹) in a full-screen modal. It shows the same ledger,
search and filter bar without the timeline overview, and the record inspector opens over the whole
ledger and closes back to it. Close, Escape or Browser Back restores the originating view. With no
turns yet, the modal shows an empty-state card in place of the toolbar and ledger, with a **Plan in
Chat** button that closes the modal and selects Chat. The surface is
[`PhoneTrajectory`](../apps/web/components/workspace/PhoneTrajectory.tsx).
On the phone each record is a fixed 56 px card: its kind icon sits on the left, the request on the first line
and its result on the second, and text beyond two lines is clipped (the inspector shows the whole text).
The toolbar's Turns, Calls and search controls are 44 px high, the search text is 16 px so iOS Safari does not
zoom in, and the inspector's tabs and section headings are 44 px targets. The
[phone trajectory note](../.agents/notes/implemented/feature/2026-10-24-phone-trajectory-cards.md) records why.
When the trajectory is narrower than 820 px, as in the default desktop chat column, the inspector opens under
the full-width ledger instead of beside it, and its body scrolls. The toolbar buttons, the inspector tabs and
the step dots are compact controls rather than the app's pill buttons, and the timeline lane labels keep one
line. The [desktop trajectory note](../.agents/notes/implemented/feature/2026-10-24-desktop-trajectory-layout.md)
records why.

- **Simple view.** The tab opens, on desktop and on the phone, on a simple list: one row per traveller
  message with a summary of what the traveller said, the avatars of the specialists that took part (never
  the Coordinator) and the result (Working, Done, Failed or Needs change). Pressing a row opens it, one at
  a time, to list its steps and each step's assignments and checks in order. The Simple and Full view
  buttons switch in place to the ledger below; the open row is the selected turn, so the ledger scrolls to
  it and switching back keeps the row open. Reopening the tab, or opening another chat, starts on the simple list again with no row open. Both views
  read the same `buildTrajectory` turns ([`TrajectorySimple`](../apps/web/components/trajectory/TrajectorySimple.tsx)
  adds only `summary` and `result` on each turn). A reply summary opens its turn and a team-panel row
  filters whichever view is showing. With no turns the existing empty state shows and there is no switch.
  The [Agent Note](../.agents/notes/implemented/feature/2026-10-27-trajectory-simple-default.md) records why.
- **Records.** `buildTrajectory` (`lib/trajectory/adapter.ts`) maps the stored messages and their
  `activity` events to one turn per traveller message. A traveller message is a User record. A Coordinator
  summary and the reply are Assistant records named with the assistant's current name, custom names
  included. An assignment (`agent_started`) and a check (conflict check, revision score, stop) are Tool
  records. A specialist's tool call is a Subtool record placed under its assignment. A failed assignment
  or tool call is marked failed. An unfinished request shows the live events and settles when the reply
  arrives.
- **Steps.** Each workflow round is a step, shown as a dot on the first record of the round, named Step
  N. The traveller message sits in a Message group before the first step. Selecting a step opens its
  status and call counts.
- **Ledger.** The table is the copied DSH ledger: turn labels, fold of a turn or an assistant's calls
  (toolbar buttons or a double click), search, a lane overview above it and an inspector for the selected record
  with Summary, Payload and Result tabs (Preview and Raw for messages). Records carry no timestamps,
  so the overview uses event order and equal widths and the inspector shows no duration or token field.
- **Overview and search.** The overview draws one lane per record type present, one block per record in
  event order. Clicking a block selects its record and scrolls the ledger to it. Searching a specialist
  name, a place or a flight number narrows the ledger to the matching records, highlights them and shows a
  hit count; the previous and next buttons, Enter and Shift+Enter step through the hits in event order,
  wrapping at the ends, and scroll the current hit into view.
- **Live tail.** While a reply streams the ledger keeps the newest record in view. Scrolling up stops
  following until the traveller scrolls back to the bottom.
- **Inspector.** An assignment shows its objective under Payload and the specialist's output or failure
  under Result; a tool call shows its arguments and result or failure; a conflict check shows the decision
  under Payload and, under Result, one line per conflict naming the specialist it sends back. Esc, from the
  inspector or the ledger, or the close control closes it and returns focus to the record's row.
- **Reply summary.** The one-line summary of a finished reply's Think row (for example "Coordinator + 3
  specialists · 2 rounds") is a button. Pressing it clears any specialist filter and opens the Trajectory
  tab (on a phone, the full-screen Trajectory modal opened from Agent Team) with that reply's turn centred and unfolded. The
  Think label and chevron still expand the row. The request is `openTurn` in
  [`trajectory-focus.tsx`](../apps/web/components/chat/trajectory-focus.tsx); `messageTurns` in the adapter
  numbers each message with its turn.
- **Labels.** Ledger labels come from `components/trajectory/locales.ts` in English and Chinese; the
  tab names are app messages. Both survive a reload because they derive from stored messages.
- **Source.** The ledger files carry DeepSeek Harness's MIT header and are listed in
  [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md); see
  [the Agent Note](../.agents/notes/implemented/feature/2026-10-24-trajectory-tab.md).
- **Verification.** `trajectory-tab` E2E (fixture mode, 1440, English and Chinese) saves the simple list, an
  open row, the ledger,
  inspector and reloaded screenshots and `result.json` under `output/playwright/trajectory-tab/`;
  `summary-jump` (1440 and 390, English and Chinese) sends three turns and checks that each reply's summary
  opens its own turn, saving screenshots and `result.json` under `output/playwright/summary-jump/`.
  `trajectory-demo` is the Stage 2 walkthrough record described in the [demo runbook](demo-runbook.md#trajectory-walkthrough).

## Reviewing a plan

The Trip header shows the destination, localized short date range and traveller count.

The budget is one summary line: the known total over the budget limit, the unpriced count and one
status wording, with a progress bar under it. The estimated total appears once. The status says
“At budget”, “Within budget” or “Over budget”; when the known estimate equals or stays below the budget
but costs remain unpriced it says “unpriced costs not counted” (or “unpriced stops not counted” at
exactly the budget without missing transport) and uses the caution colour. The status wraps within the
panel at narrow widths. Tapping the line expands one row per category (accommodation, transport, meals,
activities) with its known total; the rows have no provider text, item names or notes, and the details
stay on the stop or booking row. A category with no known cost shows “Not costed” instead of a zero.
Restaurant suggestions are excluded from the meals count; a scheduled restaurant is counted once as an
itinerary Stop. The unpriced count includes all categories and an unquoted transport estimate, so it can
exceed the activity count. Published zero fares remain zero. The category amounts add up to the known
total. The summary starts collapsed and is at least 44 px tall on a phone.
A count badge next to the trip title
(top bar on desktop and tablet, phone top bar on phone) lists open items: scheduled overlaps,
unlocated stops and failed place lookups, plus any itinerary issue from an edit that names no stop
(listed as plain text under Itinerary issue, because there is no stop to select). It is absent when
there are none. Tapping it opens a glass
popover; selecting a row takes the traveller to its stop and day and closes the popover, as do Esc
and an outside click. Unpriced items are not open items and stay counted on the budget line.
Names of removed surfaces below appear only to explain their removal; nothing in this section
describes current behaviour except the absences.

- **There are no decisions to approve.** `HitlCheckpoint`, `TripPlan.hitl`, the checkpoint cards, the
  approve/reject/defer actions and `POST /api/hitl` are all removed. The app cannot apply a
  traveller's decision yet, so it does not ask for one: presenting a list of things to confirm would
  offer a capability that does not exist.
- **What the plan does decide is reported, not asked.** The accommodation specialist compares every
  eligible candidate and names one; the transcript shows that choice with the alternatives it
  compared, and the Trip timeline shows that flight or stay with its cost. A traveller who
  wants a different one opens its row and picks it (see [Flights, stays and tips](#flights-stays-and-tips));
  anything else is said in chat or edited in the Trip timeline.
- **Conflicts are information.** When the orchestrator detects a conflict it retries the affected
  sections within its round budget, and anything still unresolved stays visible on the plan rather
  than becoming a card that waits for an acknowledgement nothing can record. It is shown on the stop,
  day or budget bar it concerns (see Conflicts in place under the Trip itinerary above).
- The client is not a source of supplier facts: totals are recomputed from proposal items, and
  results are labelled as SerpApi live search, Google Places estimates or simulated fixtures. None
  of them creates a reservation.

## Flights, stays and tips

The Trip itinerary does not render the specialists' cards (Day plan, Getting around, Stay, Destination
guide and Food & dining). Their content is in the day view. Plan sections stay in the data; no section
summary, assumption or model-written working note is shown. Day plan and Getting around have no
replacement, because their content is the stops and legs. The Trip workspace's cost and total still
include every section. Why: [Agent Note](../.agents/notes/implemented/feature/2026-10-08-day-view-specialists.md).

- **Stay rows.** A stay has one row at the end of each night's day, so a four-night stay gives four
  rows, and the checkout day has none. A row names the stay and its city, with "Night n of N"; its cost
  is the nightly price for the rooms. Opening it shows the stay card.
- **Flight rows.** A flight the plan priced is a row on its day, and the first day starts with the
  flight in. Inter-city flights are rows on their day. When the arrival flight is a round trip, its
  return is a flight out at the end of the last day of the day strip, showing the return date; it shares
  the arrival flight's selection and costs nothing more ("Included in the outbound fare"). A flight row's
  time column shows the departure and arrival times of its leg when the provider gave them; otherwise the
  row says "time not set", as mock fares do. Timed ground hops
  stay as fixed rows. A trip with no flight, no stay or no guide shows no empty row or block.
- **Stay card.** Rating, check-in and check-out, rooms and nights, nightly price, cancellation terms,
  the source note, and a link to the property's details when the planner has one. A stay whose
  selection no longer matches says "This stay needs a new selection."
- **Flight card.** Each flight shows its carrier, departure (or return), travellers, stops ("Nonstop"
  when none) and flight time. A flight whose selection no longer matches says "This flight needs a new
  selection."
- **Also found.** Each card lists the alternatives the chosen flight or stay beat, each with its price and
  its difference from the chosen one; a cheaper difference is green and also carries a minus sign.
- **Choosing another.** In a stay or flight card, each Also found row is a button ("Take … instead, …", at least 44 px tall
  under a coarse pointer). Pressing it applies at once, with no preview: it sends a `choose` edit
  through `POST /api/trip/preview-edit` ([API](api.md#post-apitrippreview-edit)), so the server
  rewrites the item's sentence, the section cost and the plan total. Taking the earlier option back
  is another choice from the same list. While another change is in flight the rows are plain text. A failed swap shows a notice
  in the Trip panel, and a response that arrives after the traveller opened another plan is
  dropped. Plans saved before items carried a `selectionId` cannot be re-priced and must be
  replanned. See the
  [Agent Note](../.agents/notes/implemented/architecture/2026-10-07-selection-id-on-proposal-items.md).
- **Travel tips.** The destination guide's advice (customs and etiquette, safety, entry and health,
  weather and packing, and places to explore) is a collapsible block at the bottom of the Trip panel, below the days. It
  starts collapsed unless this viewer has saved an expanded preference for that trip in this browser
  (`localStorage`, key `trip-tips-folded:<tripId>`). The
  block is absent when the plan has no guide. A new guide has at most five tips of one sentence each (one place to explore, customs, safety, entry and health, weather and packing), with packing as one comma-separated line of at most four items. The panel shows at most five tips and the first sentence of each (the dated weather lines stay whole), so plans saved earlier are short too; their stored text is unchanged. Advice spanning multiple calendar months identifies, inside the sentence, that its scope is the first month. The entry and health tip ends with a short "check official sources" clause, and the full caution is kept in the guide's assumptions; a saved scope sentence ("Planning context for … only; recheck …") is skipped when the panel picks the displayed sentence.
- **On-trip day.** When today falls within the trip dates, the day view initially selects today and marks it “Today”, using the first resolved destination’s time zone. While the Trip view stays open, the date refreshes each minute and when the window regains focus or visibility. Budget and travel tips initially collapse; a valid manual day selection is saved per trip in this browser (`localStorage`, key `trip-day-selected:<tripId>`) and is restored during the same destination-local day. When that day changes, the selection yields to the new Today; expired or out-of-range selections also yield to Today (or Day 1 when today is outside the trip). Saved tips preferences still take precedence. Without verified destination coordinates, the existing first-day defaults remain. Timed next-stop highlighting is deferred.
- **Restaurants.** The restaurants the dining specialist found count in the "N ideas" chip and are
  listed on the Ideas tab of the Add to trip panel. Adding one schedules it on the open day as a stop,
  with no price, and the change can be undone. The dining meal budget stays in the plan's
  estimate and total, and is not shown as a card.

## Map and places

- **Place lookups** (`components/map/useTripPlaces`, `lib/map/place-query.ts`):
  - A lookup uses, in order, a saved `placeId`, the activity's `location`, or a title that is itself a
    place name.
  - Descriptive activity text and mock placeholders (“Mock attraction near …”) are never sent to
    Places, and nothing is invented.
  - Destination cities (split on `&`) are looked up separately for framing.
  - Results are applied one by one. Photo metadata stays in memory; saved stops keep only
    their name, address and coordinates in `savedPlace` alongside their provider ID.
- **Failure handling.**
  - Activities without a usable name or a Google match are “no confirmed place yet”; the timeline
    shows “Location to be confirmed”.
  - Rate limits, timeouts and outages are retryable, and Retry places repeats only those lookups.
  - The map shows a compact status in the interface language (`role="status"`, for example "3
    activities have no confirmed place yet"); located markers stay visible and there is no blocking
    error.
- **Framing** (`lib/map/map-view.ts`):
  - The map frames the destination first: zoom 12 for one city, or bounds capped at zoom 12 for
    several, widened as cities resolve.
  - Once markers exist it fits them once, capped at zoom 15 (zoom 14 for a single place).
  - It reframes only on a trip or destination change. Drag, zoom and Show my location count as
    user moves and are never taken back.
  - With a destination that cannot be placed, a neutral placeholder is shown instead of the map.
    With no trip at all the basemap itself is shown (see Empty map). Container resizes keep the
    centre.
- **Empty map** (`TripMapCanvas`, `useHomeBase`, `PhoneMapSheet`). With no trip the map area renders
  the real basemap, centred on the travel profile home city (resolved through the places search
  route) when it resolves, otherwise a world view (`data-basemap-centre` is `home` or `world`). A home base that resolves
  after the traveller panned or zoomed the map leaves the view where they put it. One
  glass hint (`glass-float`) asks "Where are you going?"; on the phone it carries one button,
  Plan in Chat, that opens Chat. At tablet width the top bar's Chat and Map switch already reaches
  Chat, and on wide desktop the map area stays hidden until a trip exists, so neither shows a
  button. If the style or tiles fail, the hint stays on a plain background with no error alert. The
  phone Day stops sheet is not rendered without a trip; with a trip whose selected day has no stops
  it opens collapsed to its handle plus one line, "Nothing planned for this day yet.", and the day
  chips remain reachable by expanding it. See the
  [empty map Agent Note](../.agents/notes/implemented/feature/2026-10-27-phone-map-empty-hint.md).
- **Empty phone screens.** Every empty phone screen says one sentence and offers one primary action, and
  no screen says the same thing twice. Chat keeps the composer prompt and example chips and drops the
  estimates footer until a message exists. Mine with no trips and no saved chat shows the Trips heading,
  New trip and "No trips yet."; the search field, the Trips and Calendar switch and the Chats section
  (with its blank row and New chat) appear once there is something to search, switch or open. A day with
  no stops says "Nothing planned for this day yet." and leaves Add to Day N as the
  day's own control; Ask AI is an item in the day menu and in each stop's menu. The empty Trajectory says "Each step the assistant takes will be listed here after
  you send a message." beside Plan in Chat; a phone Trip drawer without a plan offers Plan in Chat only.
  See the [empty phone screens Agent Note](../.agents/notes/implemented/feature/2026-10-27-phone-empty-states.md).
- **Markers** (`components/map/map-layers.ts`, `lib/map/place-category.ts`). Each located stop is a
  numbered badge in its day's colour (`--day-1` … `--day-7`) on the place with a label pill beside it: a category icon from Google's
  `primaryType` and the place name, cut to 22 characters (26 when selected). Stop numbers come from
  the Itinerary (`lib/trip/itinerary.ts`), the one reading of the plan that the maps, the Trip
  drawer, the timeline, the phone map and the Trip button share
  ([Agent Note](../.agents/notes/implemented/architecture/2026-10-06-one-itinerary.md)): numbers are
  trip-wide, one per place in visiting order (day, then start time, then plan position), and a
  place visited again keeps its first number. Ideas (activities without a day) are never numbered,
  counted or mapped. An Idea's price is not part of the estimate or the budget total, and moving a priced stop to Ideas lowers the total at once. Below zoom 12 only the selected stop keeps its label,
  and when the map settles a label that would overlap one already shown is hidden (the selected stop
  wins, then visiting order). Markers never load place photos.
- **Itinerary lines** (`lib/map/itinerary-route.ts`, `components/map/map-layers.ts`). Each day's
  stops are joined in visiting order. A leg follows a verified Google Routes polyline when one exists
  for that exact pair of places; otherwise it is a gentle arc (`curvedPath`, a quadratic curve in
  Web Mercator bending to the left of travel), so a day reads as one flowing path rather than a
  zig-zag. No route is requested just to draw a line. The focused day (the selected stop's day, or
  every day when nothing is selected) is drawn Apple Maps style in its day colour over a
  `--route-casing`, with a white chevron at the middle of each leg pointing to the next stop and
  white dashes flowing from stop to stop; other days are a thin static `--text-dim` line. A leg whose verified route names a travel mode also carries a round badge at the midpoint between its two stops, with a walking, public transport, driving or cycling glyph and that mode as its accessible name; a leg drawn as an arc has no verified route and so no badge. The badge sits under the place markers, so a stop's label is never covered. Switching the interface language immediately updates existing badge titles without changing the selected day.
  Dash animation pauses while the map panel or document is hidden, without discarding the map, camera
  or selection. It also respects reduced motion. OSM draws static routes without an icon animation loop. The dashes
  move in one `requestAnimationFrame` loop throttled to about 30 frames a second, which stops when
  the lines are redrawn or the map unmounts. Under `prefers-reduced-motion: reduce` the dashes are
  drawn still and no loop runs. Verified routes that are not an itinerary leg, such as an edit
  preview, stay solid lines. The map follows the system light or dark scheme.
- **Place popup.** Pressing a marker or its label, or a place in the Trip timeline, opens the place's
  details over the bottom-left of the map: stop number and day, first Google photo, name, address,
  Google rating, the photo's author attribution and an Open in Google Maps link, plus Route from my
  location once the traveller's position is known. Photos load only
  in live data mode with a server Maps key, one image per selection. Otherwise, and when Google has
  no photo or the image fails, the fixed 16:9 slot shows a pin. A marker press moves focus into the
  popup; the close button, Escape or a press on the map closes it and returns focus to the marker.
  A place chosen in the drawer that is off the map is panned into view, which does not count as a
  user move.
- **Selection.** Selecting a marker or a drawer place selects the activity in the timeline and jumps
  to its day, and the reverse also works. The selected marker has a larger outlined badge and a
  bordered label, and its drawer row adds a leading inset line and weight alongside `aria-pressed`;
  color is not the sole cue. Stops on other days step back to grey badges without labels.
- **Trip itinerary.** One itinerary view: heading and summary, compact budget,
  collapsed travel tips (when the plan has a destination guide), the day strip, the chosen day's stops in visiting order with the number
  their place carries on the map (a repeat visit keeps it), and the day's flights and stay rows.
  Parked places show as an "N ideas" chip above the day strip, unnumbered. On wide desktop the linked map is visible beside the itinerary; on tablet an Itinerary/Map
  switch shows one at a time. The phone Trip tab continues to show the existing Trip surface. The
  itinerary has no status label:
  "Needs review", "Draft" and "Review plan" are removed ([Agent Note](../.agents/notes/implemented/feature/2026-10-08-remove-status-labels.md)).
  The specialists' cards are not rendered; see [Flights, stays and tips](#flights-stays-and-tips).
- **Conflicts in place.** Each unresolved conflict of the plan is shown where it applies, derived from the
  plan on every render by `placeConflicts()` (`apps/web/lib/trip/conflicts.ts`):
  - on the stop it names: a time overlap marks each stop of that day that overlaps another scheduled item,
    and a leg's route or timing notice is listed on the stop the leg leads into (its destination), never on
    the other stops of the day;
  - under the title of the day it names, when no stop of that day is involved (a flight or stay overlaps,
    or the pair is no longer on the plan);
  - under the budget bar when it names neither stop nor day, such as the over-budget or infeasible-budget
    sentence.
    An edit that resolves a conflict removes it from the view. A notice the plan keeps is stored with its
    key and values and shown in the traveller's language; the English sentence kept for the chat is not
    shown beside it. A sentence the app wrote in English before its notice was keyed (a plan saved earlier)
    is read back as its key when it matches the app's English text, and placed as above: on the stop it
    names when that stop is on its day, under the day title otherwise. A sentence that matches no app text
    is shown as received ([Agent Note](../.agents/notes/implemented/feature/2026-10-09-notice-keys.md)).
- **Estimate change after a replan.** After a chat replan that had an earlier estimate, a notice in the
  notices strip says the signed change, "Estimate changed by +AUD 120.00 from the previous plan.", or
  "Estimate unchanged from the previous plan." It has a Dismiss button and shows once. A timeline edit or
  opening another chat clears it, and a reload does not restore it.
- **Visit progress.** Every stop has one state: Planned (the default for existing trips), Visited or
  Skipped. Its menu changes the state, and Undo restores the previous plan. The label is saved with the
  stop and survives reopening a saved trip. Changing progress preserves its schedule, details, note,
  booking and cost, including the plan total; it does not select the next stop. Only Visited and
  Skipped show a tag on the row; Planned shows none.
- **Quiet stop rows.** A stop row shows its time, name, one short line and the price or "Price
  unknown" on the right, with no "Place confirmed", "Planned" or "Price needs checking" tag. Problems
  that need action stay visible through the Open item badge and the conflict list under the row. The
  time cell, the flight, stay and transfer icons and the idea icon have no fill or ring; the time
  still changes colour on hover and while its popover is open, and keeps its focus ring. A day ends
  on its Add button with no helper sentence. Verify with
  `pnpm --filter @trip/web e2e quiet-stop-rows` (1440 px, 390 px and Chinese).
- **Stop menu** ([Agent Note](../.agents/notes/implemented/feature/2026-10-27-stop-menu-popovers.md)).
  Each stop's "…" menu (`ActionMenu`, a `role="menu"`; arrow keys move, Escape closes it and returns
  focus to its trigger without closing the drawer) offers Adjust schedule, Edit details, Add a comment,
  Move to ideas, Move to previous day, Move to next day (the first is disabled on Day 1 and the second on
  the last day), Add again and Remove, then Replace place (opens the place search in the card), Open in
  Maps (only when the stop's place has coordinates; it opens Google Maps directions to them in a new tab,
  which hands off to the phone's maps app and needs no API call), the visit-progress items and Mark as
  booked. Parked places have no row; the Ideas tab of the Add to trip panel schedules them. Adjust schedule, Edit details, Add a comment and
  Schedule on a day open a small popover attached to the row (`StopPopover`, a `role="dialog"` named for
  the action) at every width; it takes focus, closes on Escape or a tap outside without saving what was
  typed, and returns focus to the row. Tapping the time opens the same Adjust schedule popover; tapping
  the row opens place details. Add again puts the same place on the day a second time as a new stop timed
  after the day's last stop. Move to previous day and Move to next day put the stop after the target
  day's last stop. Details, comments, booked and visit progress apply in the browser at once. Move to
  ideas, Move to previous day, Move to next day, Add again and Remove are checked by the server like any
  timeline edit, and an accepted one applies at once. Each settles the plan the way a server edit does: the budget
  total and the conflicts are recomputed at once, with the same roll-up the server uses
  (`lib/trip/settle.ts`). A day with no room left refuses the move or the add with a notice and changes
  nothing. Undo survives background place saves and route checks without discarding their unrelated updates. Undo offers the last change
  until the next plan arrives from chat. The step stays with its Trip through navigation and layout
  changes, and another Trip never offers it. Reloading clears the in-memory step. An item action is
  undone the same way, restoring the plan as it was before it. A move changes the day's times, so the day's legs are routed again (see Legs under Timeline editing). At
  phone width (520px and below) the menu's trigger and items are at least 44 px. An open menu is capped to
  the height of its scrolling panel, scrolls inside itself, and keeps the focused item on screen above the
  tab bar. Missing or zero budgets
  state that no budget is set; invalid totals never render `NaN`, a negative bar, or a bar wider than its
  container.
- **Add to trip panel** ([Agent Note](../.agents/notes/implemented/feature/2026-10-27-add-to-trip-panel.md)).
  An Add button ends every day and opens one panel under the button; the "N ideas" chip opens the same
  panel for the open day on its Ideas tab. The panel has the tabs
  Search, Ideas, Saved and Custom, a Keep open checkbox and Close. Search takes a place name,
  starts near the trip destination and has the filters Places, Stays, Restaurants, Experiences and
  Events; a filter sends its kind to `/api/places/search`, which adds a query word, and narrows the
  results by their place type (amusement parks count as Experiences, a place with no type shows under
  every filter, and a filter that hides every returned place shows "No places found"). Ideas lists unscheduled places and schedules the chosen one on the day.
  Saved lists the places saved on the account's other trips (`lib/trip/saved-places.ts`), once each.
  Custom takes a name, an optional start time (day only, 22:59 at the latest; the end is an hour later) and a note. Choosing a
  place adds it to the day at once; a result with
  coordinates keeps its saved map match, and one without is matched by the automatic place save or
  shows its search box when that fails. There is no preview, Day or time form or confirm step. A place
  already on the day is added again as its own stop. A day-only `add` is timed by the server after the
  day's last stop and no earlier than that stop's travel plus 15 minutes; a day with no room refuses
  with a notice. Every edit applies as a plan revision and offers Undo; the panel closes after an add
  unless Keep open is on. A running assistant disables both Add buttons and the panel. Escape and Close
  never ask to discard and keep no draft. Controls are at least 44 px at phone width.
- **Trip AI shortcuts.** Asking AI about a day or Stop opens Conversation after the request is accepted,
  so progress, replies and retry actions are visible. Cancelling the manual-change confirmation keeps
  the traveller in Trip.
- **Location.** Location is asked only when the traveller presses Show my location
  (`components/map/useUserLocation.ts`); no card or notice asks on open, so the browser's
  permission prompt appears only after that press. After a press that the browser granted and
  while it still grants, later visits show the position without asking. Denied, unavailable,
  timeout and unsupported cases are explained on the map. Only that earlier press is stored
  (`trip.locationPrompt`): the position stays in memory and is never saved or written into the
  plan. Route from my location requests a verified duration and distance for the selected place.
  See the [location prompt Agent Note](../.agents/notes/implemented/feature/2026-09-24-location-prompt-and-itinerary-map.md),
  superseded for the opening question by the empty map note above.
- **Controls.** A stack of round glass buttons at the bottom right, as on Mindtrip and Apple Maps:
  Show my location (a location arrow; it asks for the position, or centres on it at zoom 14 or
  closer once known, fills in while the position is shown, and reads Retry my location after a
  failure), Satellite view (`aria-pressed`, switches between the road map and hybrid imagery), and
  Zoom in / Zoom out joined into one capsule. The traveller is an Apple-style blue dot with a slow
  halo. Google's own controls are all disabled (`disableDefaultUI`), wheel zoom and one-finger pans
  need no modifier (`gestureHandling: "greedy"`), and the dev-only `/debug/map` page shows the map
  with fixed Sydney stops and no Places or pricing requests.

## Timeline editing

The day view (`TripEditor` composing `components/trip/timeline/`) shows one day at a
time and edits activities through `POST /api/trip/preview-edit`. The server checks each edit and
the client applies an accepted one at once. Every change to a stop's day, time, place, order or leg is
checked by the server: time, place, leg, a drag, Remove, Move to ideas, Move to previous day, Move to next day and Add again. Details, notes, booked and visit progress apply in the browser. The checks are deterministic and make no LLM calls.

- **Layout.** A day strip of tabs (`Day 2 · Sun, 18 Oct · 3 stops`, flagged when a stop needs a
  place) picks the day. Each tab has a unique ID and controls the single visible day panel; that
  panel is labelled by the selected tab and contains the day's heading and timeline. The "N ideas" chip
  sits above the day strip, outside the day panel, on desktop and phone. The day is a vertical line in time order (`lib/trip/timeline.ts`): an
  flight in first (untimed flights and hops), timed inter-city hops and stops by start time, then one
  stay row per night, and on the last day the flight out, which ends the day. "Staying at …" shows on
  later nights. Narrow timeline containers use a 56 px time column so five-digit times fit before the aligned stop dots. Fixed rows show an icon, a title, one detail line and their cost ("Fare not published"
  or "Price unknown" rather than AUD 0). Flight and stay rows open to their card. Between two stops the
  journey is a leg (see Legs below): its mode and duration, marked "checked" when the provider verified
  it and "estimate" when it is the planner's `arriveBy` or a simulated fixture.
- **Trip scroll.** A fresh Trip view starts above the budget. Revealing the selected day only scrolls the day strip horizontally; it does not move the surrounding Trip panel. Closing and reopening, or switching phone tabs, preserves a traveller’s deliberate vertical scroll.
- **Prices.** Stops without a published price carry no `estCost` and show "Price unknown"; the
  budget line shows their count, avoiding the impression that the total covers every cost.
- **Order and numbers.** A day's stops are listed in visiting order, and each stop's node shows its
  trip-wide stop number, the same as on the map and in the Trip timeline; an unlocated stop shows
  none. Drag and drop names a position as shown;
  the Itinerary turns it into the plan index `preview-edit` expects, which counts the day's other
  stops in plan order. When start times disagree with plan order, a stop moved later lands just
  after the stop it moved past and any other move lands just before it, so the preview keeps the
  swap the traveller asked for; the endpoint then re-times the rest of the day after it.
- **Time and place.** In the narrow Trip view, the time form uses the full timeline row so its controls remain visible without horizontal scrolling. An expanded stop's place card also spans its full timeline row, and its editor fields and actions fit the card. Tapping a stop's time opens its Start and End form; "Change time" sends the change
  to the server check. Selecting a stop, here or on the map, opens its place card: the place's first
  photo (live data with a Maps key), rating, address and an Open in Google Maps link. Replace place in the stop's menu opens a
  Google Places search in the card; a picked result is saved through the server check. Escape closes an
  open form or the card and returns focus to the stop. For a place still being looked up or not found, the name and close control share the first row and the lookup status spans the row below. Drag and drop still reorders the day.
- **Editing.** A stop is compact until selected, here or on the map; selecting it opens its editor:
  a Google Maps search to replace the place. Drag and drop still reorders the day.
- **Places from the map.** When the map finds a stop's place by name and the stop has no saved
  place, the workspace saves that place on the stop itself, once, through the immediate place edit
  below; no traveller action is needed. While it is being saved the stop reads "Saving place…"; a
  save the server does not accept reads "Place not saved yet" and the card says to search for the
  place. A stop the map cannot find reads "Not found on the map", and its card offers a search that
  saves the picked result. A lookup that failed for a retryable reason is not saved; "Retry places"
  on the map runs it again. Saves and leg checks share one queue: one background request
  for the trip at a time, and both wait while chat, a place search or another edit is running. A save or
  check that a traveller's edit or chat overtakes is discarded and asked again for the edited plan.
  The traveller replaces a saved place from the card's search.
- **Legs.** Each journey between two stops of a day is a leg ([Leg](../GLOSSARY.md)). There is no button:
  a day's legs are checked once every stop on it has a confirmed place, including a day whose stops
  already carry the planner's arrival times. That check also runs on each reload, because a stored leg is
  only an estimate until it is checked. A day is asked again whenever an applied edit changes its stops or times. Changing one leg's mode (a select with Walk, Public transport or
  Drive or Cycle; "Not checked yet" until the leg has a mode) routes that leg alone; the rest of the day is
  re-timed with the stored times of its other legs. The chosen mode is kept through later re-timing,
  and Undo restores the previous mode. A leg the traveller has not chosen walks when the walk takes
  20 minutes or less, and otherwise uses public transport when the provider finds one.
  A leg with no route between its two places reads "No route found" and adds no time to the day.
  A provider outage on a leg is a notice, not a refusal: the stop keeps its time, the leg adds no time,
  and the notice shows on the stop the leg leads into. A move that needs that route is refused instead,
  and the plan stays as it was. In mock data mode the server answers with fixture legs marked "estimate", never "checked".
  A reload shows the stored legs as estimates, and a "No route found" result is not kept across a
  reload. Confirming a stop's place still needs a Maps key or a stub.
- **Drag within a day** ([Agent Note](../.agents/notes/implemented/feature/2026-10-27-drag-in-day.md)).
  The whole Stop row is the drag target, with no handle: a mouse drag starts after 5 px, a touch drag
  after a 400 ms long press, and a quick swipe still scrolls. An insertion line marks where the Stop
  will land; dropping applies one `move` edit with an Undo, and the Stop numbers, times and Legs
  refresh. Dropping on its own position, outside the day list or after Escape changes nothing.
  Presses on form fields, links and open menus never start a drag, and a trip locked by a running
  assistant (or by an edit still being checked) disables drag, including a drag already under way.
  The list scrolls when the pointer nears its edge. The keyboard route is Alt+ArrowUp and
  Alt+ArrowDown on the focused Stop; a polite live region announces "{name} moved to position {n} of
  {total} on Day {d}". The drag state lives in `components/trip/useItineraryDrag.ts` and addresses
  rows and lists by `data-drop-row` and `data-drop-zone`.
- **Day menu and itinerary menu** ([Agent Note](../.agents/notes/implemented/feature/2026-10-27-day-menus.md)).
  Each day has a menu named "Day {n} actions" next to its title: Edit title, Add note (Edit note once a note
  exists), Add day before, Add day after, Clear day and Remove day, and a Day map button that shows that day on the map (on a phone or a narrow layout it also
  brings the map forward). The itinerary has a menu named "Itinerary actions" in the toolbar above
  the day strip: Move all events to ideas and Remove all scheduled events. Every item applies at once as one plan
  revision with the usual Undo and no dialog. Adding a day lengthens the trip: before Day 1 the start date
  moves a day earlier and every booked date stays put, anywhere else the end date moves a day later and
  later stops, stays and flights move with it, the Brief form's dates follow the plan, and Add day after the last day opens the new day; a stay that spans the new day gains a night and its cost
  and text follow. Remove day trims the same way, and is refused with a notice when the day holds a
  flight or would take a stay's last night; it is disabled on the only day. Clear day is disabled on an
  empty day and keeps the day's title and note. Edit title and Add note open a small form under the day
  heading (a modal popover on a phone) and save at once with the usual Undo; the title is up to 80
  characters and shows after the date, the note is up to 500 and shows under the heading, and saving
  blank removes it. They are stored in the optional `dayNotes` map on the plan, keyed by day number; Add
  day and Remove day move the keys with their days, Remove day drops the removed day's entry, and a plan
  the assistant returns without `dayNotes` keeps the browser's notes for the days it still has, and a revision for a mentioned specialist drops notes beyond the days the plan now has. Logic is in `lib/trip/day-actions.ts`; verify with
  `pnpm --filter @trip/web e2e day-menus --prod` (1440 px, 390 px and a one-day trip, in English and Chinese).
- **Drag across days and onto the ideas chip** ([Agent Note](../.agents/notes/implemented/feature/2026-10-27-cross-day-drag.md), [superseded in part](../.agents/notes/implemented/feature/2026-10-28-ideas-chip.md)).
  The "N ideas" chip is a drop target while a Stop is dragged and is absent when no place is parked. Every
  tab in the day strip is a drop target (only where it is visible: the part of a tab scrolled out of the strip takes no drop) that marks itself with an outline: dropping a Stop there
  appends it to that day (an empty day included), and holding a dragged Stop over a tab for 600 ms
  opens that day so the insertion line can choose any position in it. A Stop dropped on a day is one
  `move` edit, a Stop dropped on the chip is one `idea` edit that parks it last. Each is a single Undo, and the
  Stop numbers, times and Legs of both days refresh. A day without room, another accommodation
  segment, the Stop's own day tab, Escape and a locked trip change nothing or
  show the usual refusal. While the day changes under a drag, the dragged row is not drawn; the line
  and the outlined tab show the target.
- **Leg distance and Directions.** A leg whose route came back with a distance shows it after the mode
  and duration: metres under 1 km, kilometres with one decimal under 10 km. A leg with no distance, or
  between the same place twice, shows none. Each leg also has a Directions link that opens
  Google Maps in a new tab from the previous stop to this one, by coordinates when both places are
  known and by stop name otherwise; it is left out between the same place twice. Legs are always shown: there is no Show distances switch, and the
  retired `trip.show-distances.v1` browser preference is neither read nor written
  ([Agent Note](../.agents/notes/implemented/feature/2026-10-28-ideas-chip.md)). A stay whose selected candidate has a known `detailsUrl` shows a Book link to it
  on its row; stops and stays without a link show nothing. `leg-distances.e2e.mjs` checks all of this on
  desktop and phone, in English and Chinese.
- **Applied at once.** An edit applies as soon as the server accepts it, with no review step. A
  refused edit leaves the plan unchanged and lists its blockers as an alert above the day, each naming the stop it is about. A place change
  on a day with an unconfirmed neighbour is accepted: that pair has no route until both places are
  confirmed, and other edits on such a day are refused until every stop has a place. An applied edit
  shows "Undo last change", which runs the same check and applies the same way. The leg check that
  follows an applied edit does not replace the plan, so the undo step stays. The undo step covers the
  scheduled stops the edit re-times; an Idea in the plan stays as it is and does not block Undo. A plan
  that arrives from chat clears the undo step; if a change was still in the plan, the chat says that it replaced the change
  ("The new plan replaced your last change to the timeline.", with a Dismiss button). At phone widths
  (520 px and below), the Undo button is at least 44 × 44 CSS px.
- **Edits and background work.** A leg check or place save that is running when an edit starts is
  cancelled, and it is asked again once the edit has finished, so its answer never replaces the plan the
  edit is checking. An edit in flight is not cancelled when the plan changes from elsewhere: its answer is refused as stale,
  and the alert asks the traveller to try the change again.
- **Motion.** A day's list fades in when the day changes; a stop's place card rises in; an applied edit
  washes the stops it changed with the accent for a moment; a leg the provider verified draws down
  the line. Each has a text or colour signal too, and none plays under reduced motion.
  The trip panel's disclosures (budget breakdown, Travel tips) share one expand/collapse motion: the
  `disclosure` class in `motion.css` animates height and opacity over `--disclosure-duration` with
  `--disclosure-ease`, so content below moves once and never jumps; under reduced motion they switch
  instantly.
- While an edit is pending the chat composer cannot send (`ChatPanel` `locked`), but the chat shows
  no thinking row or stop button: a pending edit is not a chat request.

- Activities receive stable IDs once, retained on reorder and restore. `editVersion` is independent of
  the orchestrator round, and an edit applies only if its base version still matches.
- Moves, time changes and place replacements preserve activity duration. Following activities start
  at the later of their original start or previous end + route duration + 15 minutes. Empty target
  days start at 09:00 local, and moves stay within the same lodging destination segment.
- A provider outage on a leg does not shift the stop's time on a guess: the leg's notice is kept on its
  stop (see Legs). A leg with no route adds no travel time. Overflow beyond the day blocks apply, and the alert names the stop. Fixed transport and stays are read-only; an overlap with a stop is marked on that stop.
- Replacing a place marks the activity price for verification. Route fares are separate estimates,
  never added to transport twice, and an unknown fare is not zero.
- Edits invalidate itinerary and final confirmation and regenerate conflicts, keeping unaffected brief
  and hotel decisions. Undo revalidates instead of restoring old approvals. Chat replanning replaces
  manual activities.
- Routes use real local departure times from the Google Time Zone API; ambiguous or nonexistent DST
  times are rejected. When that call fails, the zone is worked out offline from the place's coordinates.
  Transit queries respect Google's supported departure window.
- Each travel time says which service gave it: `Google`, `Transitous` for public transport, or `OSRM` for a walk, cycle or drive answered by the
  free fallback (see [Routes and time zones without Google](architecture.md#routes-and-time-zones-without-google)).
- A hop with no Google transit answer (Japan has no transit data) or with transit over 90 minutes and
  more than twice the driving time is returned as a driving leg (`mode: "drive"`) and says so, rather
  than reported as unroutable. A hop between two trip cities first tries Google Maps transit through
  SerpApi (Tokyo → Kyoto: a Shinkansen with its fare), and drives only if that finds nothing.

## Google Maps configuration

| Variable                          | Used by                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| `MAPS_API_KEY`                    | Server: Places search and details, Routes, Time Zone                      |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser: Maps JavaScript API                                              |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`  | Browser: vector map ID for advanced markers (falls back to `DEMO_MAP_ID`) |

Restrict the browser key by HTTP referrer and the server key by API. Map loading never delays the
first render; without a browser key the map loads MapLibre/OpenFreeMap and the itinerary stays usable.

Without Google, walking and driving times come from OSRM: `OSRM_FOOT_BASE_URL` (default the FOSSGIS
foot instance) for walking and `OSRM_BASE_URL` (default `router.project-osrm.org`, cars only) for
driving. Cycling uses `OSRM_BIKE_BASE_URL` (default the FOSSGIS bike instance) and is saved as `cycle`.

## Agent Lab

`/agent-lab` is a public engineering-demo route, including when Clerk protects the main workspace.
It does not share the workspace shell or read and write its browser storage. The toolbar exposes one
registered scenario, a strategy choice and a Data mode control; Run experiment becomes Cancel
run while the NDJSON response is active. Compare all strategies runs the single-agent baseline, the
five-specialist no-revision strategy and the targeted-revision strategy one after the other and opens
the comparison view. The scenario list also offers the tight-budget Tokyo trip, where the first plan
overruns and only transport is revised; a Paris family trip whose budget no plan can meet; and a seven-night
Tokyo and Kyoto trip whose move between cities every strategy must keep consistent.

Each timeline event carries a text label for the part of the system that produced it: Run, Graph stage,
Specialist or Tool. Specialist events show the bounded objective, constraints and outcome. Revision
runs add Graph stage events for the conflict check (the conflicts and their targets), the revision
(objective and previous outcome), its score before and after, and the reason the loop stopped.

The event list sits in a bounded trace box: its height follows the viewport (at most about the
viewport minus 22 rem, between 260 and 760 px) and it scrolls on its own, with a scrollbar that is always
drawn, so the plan result and run metrics stay on screen. The box is a focusable region named for the run, so
arrow keys scroll it. While a run streams or an artifact replays, the box follows the newest event; scrolling
up suspends following so new events do not move the position being read, and scrolling back to the bottom
resumes it. The follow scroll is always instant, so reduced motion needs no separate path. The Run view, each
side of the Compare view and each Failure Lab trace use the same box.

Above the box, a time bar shows the whole run as lanes of equal-width blocks, one step per record: Run,
Coordinator, one lane per specialist (or a single Baseline lane), with empty lanes omitted. A tool call's start
and result form one block, and failed tool calls, failed specialists and rejected output are drawn in the error
colour and with a diagonal stripe, so failure never rests on colour alone. A dashed line with an R2, R3 tag marks each round boundary. The bar grows as events stream or replay.
Every block is a button named with its lane, title and step; clicking it or pressing Enter scrolls the box to
that row and highlights it for a moment (instantly under reduced motion); if a fold hides that row, the folds
open first. Blocks are 24 px tall (44 px at phone width) and keep a visible border in forced-colors mode. At
phone width the bar fits the screen and lane labels shorten (Coord, Trans, Guide, Stay, Itin, Dine, Base). In the Compare view the three
strategies' bars are stacked above the columns in strategy order on one shared step axis sized to the longest
run, so shapes line up and a shorter run ends earlier; a strategy that never ran has no bar.

Above the box, a toolbar offers two folds, **Fold rounds** and **Fold calls**, each a button with a pressed
state that works from the keyboard. Fold rounds hides every row that belongs to a round and leaves one
heading per round (for example "Round 2 · 9 events"), so only the headings and the run-level rows remain and
a long run reads as an outline. Fold calls hides every tool row, so specialist and coordinator rows read
without tool noise. The folds change only the list: the event count and the Fixture or Live label in the
panel heading stay as they are. Each list, including each side of the Compare view, folds on its own.

The comparison view shows a table of measured figures (latency, rounds, tool calls, fallbacks, failed
agents, budget, unresolved conflicts, checks, grounded sections, repeated and generic stops,
multi-city consistency, stopping reason, conflict outcome and token and model cost), the three plans and the three
traces side by side. Token and model cost reads "Unavailable", never 0, because fixture runs make no
model calls. Every figure
is read from that run's artifact; a strategy that has not finished shows "No completed run". The page never
ranks the strategies. Conflict outcome tells a strategy that never checked, one that found no conflict, one that
repaired its conflicts, one that left some unresolved and one that stopped because the budget is infeasible
apart; the inspector marks each conflict check as repairable, infeasible budget or none found, and each stop
with its reason. It states that single agent against no revision measures specialization and
no revision against targeted revision measures what targeted revision adds,
that fixture mode shows how evidence is measured and not model quality, and why budgeting, conflict
checks, state transitions, maps and weather are graph nodes or tools instead of agents.

Every completed run offers **Download artifact**, in the inspector beside the metrics and under each
strategy in the comparison. The file is the versioned run artifact exactly as the stream completed with
it, and the status region announces its name. **Replay artifact** opens a file chooser. The page
validates the chosen file in the browser and plays it back through the same timeline, plan and metrics
views, with the recorded scenario and strategy selected, each event appearing at its recorded time and
a note naming the recorded run, so a replay is never mistaken for a live run. **Stop replay** ends it
with the events seen so far and no plan. Replay makes no request, so it works offline, and it does not
touch saved chats, trips or preferences. A file is refused, with the reason stated and any result
already on the page left in place, when it is not JSON, has no or an unsupported schema version, has
missing, duplicated or out-of-order events, has events timed backwards or from another run, has a
mismatched event count or an invalid plan, records a failed run that kept no events, is larger than
5 MB or would play for more than ten minutes. Fields the contract does not define are dropped, never
shown.

Data mode is Fixture data by default. Live data is selectable only when the deployment has enabled it, and the page
says beforehand when it has not. Choosing Live data marks the scripted baseline fixture only and runs the specialist
strategies. A request the server turns away (live not enabled, or a concurrency or hourly limit) shows Live run not
started and an alert that says which limit was hit, how long to wait and that nothing was run; it is never shown as a
failed run, and fixture data stays available. The trace, the metrics, the comparison and every artifact say Fixture data
or Live data. Measured usage shows the tokens the provider returned and that cost is not reported; usage that was not
measured reads Unavailable, never zero.

Four views share one navigation group, named Run, Compare, Failures and Architecture, with the current one marked
pressed. Compare is unavailable until a run exists; the others are always available, and every view is reached and left
by keyboard (Tab, then Enter or Space). **Run** shows one run's timeline, plan and metrics. **Compare** shows the
strategies side by side. **Failures** is the Failure Lab. **Architecture** explains how the planner is built and why:
LangGraph owns the workflow state, the order, conflict detection, revision routing and stopping; LangChain agents are
bounded reasoners inside it; five capability boundaries, each with its goal, tools, output and way of failing; why
budgeting, conflict detection, state transitions, maps and weather are nodes or tools and not agents; why five is not
a fixed number; and how to read the results. Every run says how it ended with the same outcome word (Completed,
Degraded, Partial result or Failed) in Run, Compare and Failures, read from its artifact alone. A run that finished with
conflicts left says so in its headline, and an infeasible budget says the budget cannot be met. The lab keeps every
control and result reachable in light and dark, from desktop down to 320 px, and with reduced motion, where nothing
animates; its secondary text is strengthened for the lab only so text meets the 4.5:1 AA ratio. The
[Agent Note](../.agents/notes/implemented/feature/2026-10-02-agent-lab-public-release.md) records the decision.

The **Failures** view lists the five registered fault profiles. A card says where its fault is injected,
which scenario and strategy it runs on and what to expect. **Run profile** runs it, and **Run all fault
profiles** runs the five one after another; Cancel run stops the sequence. When a run ends, the card shows an
outcome word (Completed, Degraded, Partial result or Failed), a headline, the facts behind it, six figures
counted from the artifact (events, failed tool calls, failed specialists, unavailable sections, unresolved
conflicts and stopping reason) and the full trace, with the run metrics for a completed run. A run a fault
stops keeps its trace and shows no plan, because none was assembled. The outcome is read from the artifact
alone and announced in the status region, so a live run, a download and a replay of it read the same. Every
card offers Download artifact, a failed run included, and replaying a fault artifact opens this view.

The responsive three-panel inspector shows the ordered run timeline, the validated plan and the run
metrics. The metrics panel shows the real budget state (within or over, with the amount) and every
named deterministic check as Passed or Failed. If a run fails after streaming starts, the page keeps
the events recorded so far and reports the event the run stopped after. Status and errors use live regions, controls have programmatic labels and keyboard focus,
and the panels stack without horizontal overflow on phones. The result appears only after the shared
`TripPlan` contract validates it. No external provider, model key or sign-in is required.

## Accounts and settings

With Clerk configured, page navigation requires sign-in ([login gate Agent Note](../.agents/notes/implemented/architecture/2026-09-28-workspace-login-gate.md)).
Signed-out visitors go to `/sign-in` before the workspace renders. The full-page login combines a
short product introduction with Clerk's Google, Apple, GitHub and email controls. `/sign-up` uses
the same layout. Successful sign-in or registration opens `/`; signed-in visitors to either auth
entry page return to `/`. Signing out returns to `/sign-in`, and losing a session hides the workspace
while navigating there. Existing API authorization and response formats remain as documented in
[API](api.md).

On a desktop with a mouse, login and registration show a faint grid and background tint near the
pointer. Inside the form, a thin edge highlight follows its position; the controls stay still.
Introduction rows change colour and shift slightly on hover. Pointer updates are batched per
animation frame without re-rendering the form. Leaving the page, scrolling, resizing or losing
window focus clears the feedback. Touch, reduced-motion, reduced-transparency, increased-contrast
and forced-colour modes use the static page.

Without Clerk keys the workspace is single-user and auth pages return to `/`
([account storage Agent Note](../.agents/notes/implemented/architecture/2026-09-27-accounts-settings-sync.md)).
The sidebar has one **Settings & account** entry;
the account section explains that everything stays in this browser.

- **Settings & account control.** The sidebar footer follows Mindtrip's profile row: an avatar,
  full name and secondary line (username when available), with a horizontal three-dot button. The identity opens Edit profile
  when signed in, or Your account otherwise. The overflow menu opens above the row and contains
  a profile card with **View profile**, then **Account settings**, **Personalization** and
  **Language & region**. Signed in, **Sign out** sits below a separator. Each settings action
  opens that section of the shared dialog. Arrow keys move through the menu; Escape closes it
  and returns focus to the overflow button. A collapsed sidebar stacks the avatar and overflow
  button and opens the menu beside them.
- **Sync.** Signed in, chats and trips sync to the account. The first sign-in in a browser adds its
  chats and trips to the account and pulls the account's into the browser; after that each change
  is saved a moment later. The footer status reads Saving…, Synced to your account, or Saved here ·
  sync paused when the account cannot be reached. The newer copy of a chat or trip wins whole;
  untouched blank chats and panel layout stay in the browser. Signing out leaves this browser's copy.
- **Settings & account** opens the shared dialog, which follows the layout of Mindtrip's settings page. A section list sits on
  the left, with an ink bar beside the chosen section; on a phone it becomes rows of tabs that wrap so
  all five sections stay visible, with the bar under the chosen one. The chosen section's rows fill the right. Each row has a label and value, and
  Change opens its editor in place. **Account settings** opens Your account and **Personalization**
  opens Personalization. Mindtrip's Voice, Price
  alerts, Notifications and Cookie preferences have no counterpart here.
  - Intro lines, hints, sync notes and footnotes use `--text-dim`, at least 4.5:1 on the dialog glass in both themes.
  - Before opening Clerk for sign-in, account creation, profile photo or account management, the
    settings dialog closes so its native modal layer cannot cover Clerk's controls.
  - **Edit profile:** picture, first and last name, saved to Clerk (Change profile photo opens
    Clerk). Location is the home city.
  - **Your account:** email, which Manage opens in Clerk, with its verified mark; Theme (System,
    Light, Dark, set on `<html data-theme>` and followed by the map); Export; Sign out; and Delete
    my account behind a confirmation. Signed out or without accounts, the section shows how to sign
    in, or that data stays in the browser, with Theme below.
  - **Personalization:**
    - **Communication style:** Neutral, Friendly, Concise or Detailed.
    - **Assistant names:** one editable name for the Coordinator and each of the five specialists, stored
      with the account as `assistant.names`. A blank name restores the role name in the interface language.
      Names are trimmed and limited to 24 characters, and a name that another assistant already uses, as a
      custom name or as a default English or Chinese role name, is rejected with a message, so a mention can
      never be ambiguous. The @ menu, reply bubbles (including earlier ones) and Subagent rows show the
      current name without a reload. Typing `@` with the custom name, the default English name or the
      default Chinese name sends the same specialist id.
    - **Long-term memory** lists account preferences remembered from chat, with a category label and
      a delete action for each entry. Categories follow the selected interface language. Listing and
      deletion use account-scoped routes; deleting a preference removes it from later plans. A
      signed-in traveller can switch long-term memory off to exclude it from planning and prevent new
      memories from being saved. Explicit memory categories include dietary needs, pace, interests,
      accessibility, accommodation and usual departure city; trip and profile preferences take
      precedence over matching memories. Without an account, the switch is disabled and the section
      asks the traveller to sign in.
    - **What the planner knows**, grouped as in Mindtrip:
      - Identity: home base.
      - Travel party: travellers.
      - Travel style: pace and interests.
      - Food: dietary needs.
      - Budget: whole-trip budget in AUD.
      - Accommodation: loyalty programmes.
      - Other preferences: standing preferences.

      Each fact is a filled row with an emoji and bold label; clicking it edits the fact. An empty
      fact shows its question on an amber-edged row with Answer, whose accessible name adds the fact
      (Answer Home base). A new chat or trip starts from these
      facts: home base as the origin, plus travellers and budget, with pace, interests and dietary
      needs as trip preference lines. A new chat counts as blank while its facts equal these
      defaults. At phone widths (520 px and below), each edit-row button, and every field, Save button, choice, chip and select in an opened row's editor, has at least a 44 px target (a checkbox through its label);
      wrapped rows keep their natural height, and desktop sizing is unchanged. A blank chat that has not started follows changes to these facts, also after a
      reload; a chat with a message or edited facts keeps its own.
  - **Language & region:** interface language (English or Simplified Chinese; chat in any language), region, display currency (AUD, CNY, USD or JPY; default AUD), units (metric), and Trip data (the site's default, live prices or sample data)
    under Advanced.
    Interface language is changed only under Settings → Language & region (no top-bar or Mine shortcut).
    Authored chat controls, timeline and proposal labels, settings, notices, dialogs, accessible
    names and dates follow it, including data-mode tooltips and untitled-chat actions. Traveller
    text, agent-produced content and provider errors are not
    translated. Authored text that carries a value (the attachment limit, a timeline edit preview's
    differences and blockers, a stop that cannot move) is translated with `{placeholders}`, through
    `t()` or as a keyed `Notice` (`apps/web/lib/i18n/notice.ts`) that the view translates once when it
    is shown. Every notice the workspace and Settings show is a `Notice`: field errors, request and
    storage failures, map and location messages, and the `notice` the app's own routes return beside
    their English `error`. A response whose body has no `notice` is shown as received (`{ raw }`);
    one with no readable body shows "Request failed ({status})." Only a sentence the app wrote on a plan
    before its notice was keyed is matched back to a key (`keyOfAuthoredSentence`, the drawer's conflicts);
    no response text is matched. Edit preview differences arrive as values, not sentences. A notice kept on the plan (a leg or
    timing notice) is stored as its key and values inside the plan's text (`storeNotice` and
    `readStoredNotice`, same file), so it is shown in the traveller's language; the English sentence in
    the plan's `conflictsWith` is written for the chat and is not shown. With no saved choice it follows the browser language (`zh*` opens in Chinese). The desktop sidebar and main content have an 8 px gutter.
    Every workspace amount goes through the Money module (`apps/web/lib/money.ts`, read through
    `useLocale()`) and the shared approximate rate table. Converted displays carry its as-of date;
    JPY has no decimals, other currencies have two. The trip's effective currency
    (`displayCurrency`, else the stated budget currency) takes precedence over Settings. Planning and guardrails keep AUD values. `money()` converts a planning
    amount; `fare()` keeps a provider-native fare in its own currency with that currency's decimal
    places, grouping thousands from four digits up (`JPY 230`, `AUD 12.50`, `KRW 1,400`), and never
    converts it; `delta()` signs a
    difference (`+AUD 12.00`, `−AUD 30.00`, no sign on zero); the money display has no budget-gap sentence.
    Agent Lab uses the same module with fixed AUD and whole dollars (`A$3,960`, `labMoney` in
    `apps/web/lib/agent-lab/money.ts`). The sentence sent to the planner is not a display amount:
    `plannerAud()` writes it in English AUD with cents whatever the language or currency. The web
    app's ESLint config rejects `.toFixed(2)`, so an amount is never formatted by hand.
    Amounts in text the server generates (summaries, conflict reasons, progress lines) go through
    `formatMoney(amountAud, currency, style?)` in `packages/shared/src/money.ts`, which converts with
    the same rate table and shows JPY without decimals, grouping thousands in converted amounts like the
    panels (`CNY 3,000.00`); callers pass the trip's display currency (AUD in Agent Lab, whose scenarios
    name none). `estimateNote(currency)` is the estimate marking for generated text, empty for AUD.
  - **Connected accounts:** the Google, GitHub or Apple sign-ins linked through Clerk, with a button
    that opens Clerk to change them.
- Signed out, settings are kept in this browser; signed in, the newer copy of browser and account
  wins and changes save to the account.

## Out of scope

Booking fulfilment, payments, multi-user collaboration and timed next-stop highlighting remain out of scope. Mock
places and bookings must never be presented as real supplier data; live search and estimated prices
must retain their provider and freshness labels.

## Visual verification matrix

Use this checklist for each visual change. It supplements, and does not change, the layout and drawer behavior described above.

| Dimension       | Required checks                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Viewports       | 1600×900, near the 1000 px responsive boundary, and 375×812                                     |
| Theme           | Light and dark at each relevant viewport                                                        |
| Motion          | Default and `prefers-reduced-motion: reduce`                                                    |
| Input           | Mouse and full keyboard navigation, including visible focus                                     |
| Workspace       | Sidebar resize/collapse, Chat/Map switch, and no horizontal overflow                            |
| Overlays        | Navigation and chip editors; close, Escape, and focus return; Trip desktop/tablet/phone layouts |
| Content         | Empty chat/map, planning and failure states, long messages, and available map places            |
| Native controls | Date, select, checkbox, and scrollbar follow the active color scheme                            |

Keep light and dark screenshots for desktop (1600×900) and narrow (375×812) acceptance. Verify body and supporting text contrast with a contrast tool; status must retain a textual or graphical cue when color is unavailable.

No web font is loaded: body and controls use SF Pro Text and headings SF Pro Display through the system stack, falling back to PingFang and Hiragino for Chinese. `color-scheme: light dark` keeps native controls aligned with the active theme.

## Verification

For complex UI features, prefer an E2E test as the sole behavioral test: exercise the complete
traveller flow and leave a repeatable artifact. The browser screenshots required above are useful
review evidence; record the steps and command needed to reproduce the E2E run as well.

The following is the current regression-test inventory, not a prescription to add component tests
after implementation. `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` are the current
repository checks. Component tests cover drawers, the trip fact chips and their editors, blank start,
history restore, sidebar collapse, place lookup failures, request races and storage recovery, the
location question, the drawer's place list and the place popup;
`lib/map/map-view.test.ts`, `lib/map/place-query.test.ts`, `lib/trip/itinerary.test.ts` and
`lib/map/itinerary-route.test.ts` cover framing, lookup rules, stop numbers and visiting order, and the reduced-motion branch of the line animation. Live
Google checks are reported separately in session logs and are never inferred from mocks. The
historical P0–P3 plan is in [`.agents/archive/p3-implementation.md`](../.agents/archive/p3-implementation.md) and the
session logs.

OSM place cards show available text details and optional licensed Commons photos, with source and
photo attribution, and no invented rating. Missing photos leave no empty photo slot. MapLibre keeps
the same stop selection and framing on desktop and phone. Failed map tiles show a retry notice.
Same-browser tabs serialize edits and background checks; an old tab must reload before changing a
plan updated in another tab. Cancelled work does not publish a new plan revision.

A background save or route check refused because another tab changed the plan stops for that plan and shows a stale-plan Notice. The tab check compares plan contents, not key order, so a plan restored from storage after a reload stays editable; it resumes only after a fresh plan is loaded. Place details follow the current interface language, including after a language switch.
