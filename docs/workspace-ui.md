# Workspace UI

English | [中文](workspace-ui.zh.md)

The web app (`apps/web`) is a single-user planning workspace. This document describes how it behaves
now. Implementation history and browser acceptance for each phase are in the
[session logs](../.agents/session-logs/README.md).

## Layout

| Area              | Content                                                                                                                                     | Implementation                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sidebar           | Logo, Chats and Trips with counts, save or sync status, Settings & account                                                                  | `WorkspaceSidebar`, `BrandMark`, `icons.tsx`                                                                |
| Chats panel       | Slides out beside the sidebar: search, New chat, New trip, then trips and chats                                                             | `ChatsPanel`, `TripCover`                                                                                   |
| Your trips        | Opened by Trips in place of chat and map: trip cards (Upcoming, Past) and a Calendar tab; New trip                                          | `TripsPage`, `TripCover`                                                                                    |
| Top bar           | Trip title; trip fact chips (destination, dates, travellers, budget, Preferences); data mode; Trip with its stop count, rightmost           | `WorkspaceView`, `TripFactChips`                                                                            |
| Trip fact editors | One editor per chip, every one a centred dialog; Preferences holds the traveller's own list                                                 | `FactPopover`, `FactFields`, `TripCalendar`, `WhereFields`, `PreferenceList`, `lib/workspace/trip-facts.ts` |
| Chat              | Conversation, the planning transcript, the composer; starter suggestions in a blank chat; no visible heading                                | `ChatPanel`                                                                                                 |
| Map               | Only the map, labelled markers, curved day-coloured itinerary lines, the place popup, map status, and the locate / map type / zoom controls | `TripMapCanvas`, `TripMap`                                                                                  |
| Your Trip drawer  | Budget; the day view (day strip, the chosen day's stops with their place cards and ⋯ menus, then Ideas); trip sections; Review plan         | `Drawer`, `TripPanel`, `TripEditor`, `timeline/TimelineStop`                                                |

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
  - The sidebar holds only navigation: Chats and Trips with counts, in outline line icons in the
    text colour that fill in for the open panel or page, which also gets a heavier label, a quiet
    background and `aria-current`. Collapsed, they are labelled icon buttons with tooltips.
  - **Chats** toggles the Chats panel (`aria-expanded`, `aria-controls="chats-panel"`): a 320 px
    glass region at the sidebar's right edge that springs and fades in over the workspace in 380 ms
    (instant under `prefers-reduced-motion`) and is `inert` while closed. Opening it focuses its
    search; Escape closes it and returns focus to Chats (an open history menu or dialog takes Escape
    first), and a press outside it closes it. The [Chats panel and Your trips Agent Note](../.agents/notes/implemented/feature/2026-09-24-chats-panel-and-trips-page.md)
    records why.
  - The panel has, from the top: a pill search field ("Search…", the visually hidden label "Search
    chats and trips" and a Clear search button that returns focus to the field), which filters both
    lists; New chat (pencil icon) and New trip (suitcase with a plus); **Trips**, each row a small
    destination cover and "Trip to <destination>"; and **Chats**, each row its title on one line
    with the linked trip's name under it. Choosing any of them closes the panel. See
    [New chat and New trip](#conversations-trips-and-storage) for what the two starts do.
  - **Trips** replaces the top bar, chat and map with the Your trips page: a "Your trips" heading, a
    New trip button, and Trips and Calendar tabs (`role="tablist"`, arrow keys switch) drawn as a
    segmented control whose thumb slides between them. Trips shows
    every trip as a 4:3 cover card with "Trip to <destination>" and "<destination> · N days",
    grouped into Upcoming and Past. Calendar is a Monday-first month grid with previous, Today and
    next, drawing each trip as a band over its days, labelled where it starts and at each week's
    start; it opens on the next trip's month. Choosing a trip, a chat, New chat or New trip returns
    to the workspace.
  - Trips keep no photos, so a cover is a gradient chosen by hashing the destination, with its
    initial; the same destination always gets the same colours.
  - A chat row's overflow trigger at its top right opens Rename and Delete, so those
    actions stay off the row until they are wanted. It is revealed on hover and on keyboard focus,
    and always shown where there is no hover to reveal it. The menu is a `role="menu"` of
    `role="menuitem"` buttons with `aria-haspopup` and `aria-expanded` on the trigger; Escape closes
    it and returns focus to the trigger without closing an enclosing panel or drawer, and clicking
    outside or tabbing away closes it. Trips have no overflow menu because they have neither action.
  - On narrow screens the navigation drawer shows the sidebar with the panel's content (search, the
    two starts, Trips and Chats) under Trips.
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
    date is picked. `DateRangePicker` (a calendar in its own dialog, used nowhere else at the moment)
    shares the same styled calendar component (`TripCalendar`) so the two never drift apart.
  - Who is a stepper (− count +) per traveller kind: Adults (13–64), Children (2–12), Infants (under
    2), Seniors (65+) and Pets, each with its own remove/add buttons and a live count. The draft keeps
    this breakdown (`Draft.party`) and keeps `groupSize` in sync as `adults + children + infants +
seniors` (pets are never counted as travellers) on every change; `groupSize` stays the validated
    field, so at least one person is required. Opening Who on a draft with no breakdown yet (saved
    before the steppers existed) starts every stated traveller counted as an adult.
  - The breakdown reaches the planner as `TripBrief.party` (and `known.party` before a plan exists),
    beside `groupSize`. Every specialist's shared rule asks it to plan for children, infants,
    seniors and pets where its evidence allows and to say when it cannot confirm suitability;
    `groupSize` still drives all cost arithmetic. A breakdown that no longer adds up to `groupSize`
    (say, the chat later learns "we're three now") is dropped rather than sent. The
    [traveller party Agent Note](../.agents/notes/implemented/architecture/2026-09-24-traveller-party.md)
    records why.
  - Budget offers four preset cards in a `role="radiogroup"`: Budget (AUD 900), Moderate
    (AUD 3,000), Comfort (AUD 6,000) and Luxury (AUD 10,000). Each shows its amount in the
    trip's effective currency and is selected exactly while `budgetTotal` equals its AUD value.
    The custom amount field shows and accepts the trip's effective currency. Saving preserves the typed amount and currency in
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
    counts as "no minimum".
  - Below the list, "Learned from your chats" shows what the assistant recorded from the
    conversation, when there is anything:
    - each learned preference;
    - "Flights: arranged by you, not planned";
    - "Stay: <name>, booked by you".

    Each row can be removed but not edited. A removal takes effect on the next plan.

  - An editor is a labelled `role="dialog"`. Focus moves to its first field (Where with places
    already listed starts on Add destination), Tab loops inside it, and Escape, the close button or a
    saved edit return focus to the chip. A press outside the panel lands on the scrim and returns
    focus to the chip. Opening one closes the Trip drawer and the navigation drawer.
  - Edits stay in the editor until they are kept, so Escape and a press outside discard them. Each
    editor checks its own fields with the brief schema and shows how to fix one next to it.
  - Before there is a plan, Save keeps the edit in the draft; nothing is sent. The stated facts go
    with the next chat message as `known`, and Plan trip in Trip preferences plans with the whole
    brief (`mode: "plan"`). Once a plan exists the button is Update trip: it keeps the edit and
    replans with the whole brief, because a chat message carries the plan's brief, not the draft. A
    rejected brief opens the editor of the first fact at fault, with the error beside the field.
  - The trip title stays in the top bar at 1250 px and wider. Below that the destination chip names
    the trip and the title is kept for assistive technology only.
- **Chat and map split.** On desktop the chat is on the left at 56 % of the area by default, a
  little wider than the map. A separator between them (`role="separator"`, "Resize chat and map")
  moves it between 30 % and 75 %: drag it, or focus it and use Left/Right (2 % steps), Home and End;
  double-click restores the default. Dragging writes `--chat-share` straight onto the shell, and the
  layout stores `chatShare` only once it has moved.
- **Drawers.**
  - Your Trip and the narrow-screen navigation are overlay drawers below the top bar.
    They never cover the logo or top-bar buttons, and the chat and map keep their width.
  - On desktop the Trip drawer is `(1 - --chat-share) × 100%` wide, so it covers exactly the map
    wherever the divider sits.
  - `Drawer` provides `role="dialog"`, `aria-modal`, `aria-hidden` and `inert` when closed, focus on
    the close button, a Tab loop, Escape (nested edit previews and native dialogs first) and focus
    return to the trigger.
  - At most one panel is open at a time: a drawer (Trip, navigation or the desktop Chats panel), the
    phone Trip details sheet or one chip editor. Opening one closes the others; Settings and Review
    open on top of it and return to it when they close. One pure function, `layout()` in
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
    One panel is visible at a time; panels stay mounted to preserve their scroll position. The saved
    layout restores the last tab, including older Chat/Map choices.
  - The single-row top bar shows the destination and dates, or New trip. Its title opens Trip details:
    Where, When, Who, Budget and Preferences as rows. Each row opens the existing editor; saving or
    closing returns focus to the title. Editors are bottom sheets with 44 px targets.
  - Trip shows Your Trip in place, with Budget, the day view and Review plan. Before
    planning it explains the empty state and offers Plan in Chat. A plan created or changed while
    another tab is selected adds an accessible update dot to Trip; opening Trip clears it. Read revisions are tracked per trip,
    so switching between unchanged saved trips does not create a new notification.
  - Mine contains search, New chat, New trip, Trips/Calendar, the chats list and Settings & account.
    Search filters chats and trips; opening or starting either selects Chat. Each chat has a visible
    Rename/Delete row menu on touch. Data mode and interface language live here.
  - Crossing the phone width keeps the traveller on the same thing: narrowing with Your trips open
    continues in Mine, so the tab bar stays available, and narrowing with the Trip drawer open shows
    the Trip tab. Widening from Mine shows Your trips, widening from Trip opens the Trip drawer over
    Chat (unless a chip editor is open), and Chat and Map stay as they are. Settings, Review and chip
    editors stay open across the crossing; Trip details closes when the phone top bar goes away.
  - Map fills the space between the bars. Its day-stops sheet has collapsed, half and full heights,
    selected by dragging or using its handle with pointer or keyboard. Changing day filters the map's
    markers and routes to that day's stops, so a place visited on several days appears on each of
    them with its trip-wide number; selecting a stop, in the sheet or on the map, focuses that day's
    visit. Without a Maps key the sheet and stops still
    work, while the map explains its unavailable state. Place details open in a bottom sheet; desktop
    keeps its popup. The 44 px map controls stay above the stops sheet, and panning does not scroll
    the page.
  - With the composer focused and the visual viewport shortened by the keyboard, the shell follows
    that viewport, keeps the latest message visible and hides the tab bar. A focused trip-fact editor
    or stop editor field also hides the tab bar; the fact sheet rests on the keyboard, and the field
    and its Save button stay in view. Closing the keyboard or blurring restores it. Browser Back closes the active sheet or editor before leaving the workspace.
  - New labels use the English/Chinese dictionary and motion respects reduced-motion preferences.
    Browser evidence is produced by `phone-shell.e2e.mjs` and its Mine, Map and state companion walks
    under `apps/web/tests/e2e/`. Real installed-app safe areas and keyboard behavior still require the
    device checks in issue #182.

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
- **New trip** starts the same blank conversation, named "New trip", and opens the Where editor
  with focus on Destination instead of focusing the message input. It reuses an untouched blank
  conversation exactly as New chat does, and New chat renames that conversation back. The trip is
  listed under Trips once a plan is produced; until then it is a blank conversation under Chats. The
  [New trip Agent Note](../.agents/notes/archived/feature/2026-09-24-new-trip.md) records why.
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
    optional recommended choice, and (for more than one question) a pager. Submitting sends the
    answers as the traveller's next message; closing the card returns the plain composer, and the
    question text stays visible in the assistant's own message either way. There is still no
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
    place and are tested without React in `tests/lib/workspace/session.test.ts`.
  - Switching chat or trip, or New chat, first flushes the pending autosave, then aborts in-flight
    requests and clears progress, errors, selection and map routes in one `opened` session event.
    Late responses are ignored.
  - Applying an edit from the trip list or the timeline is `applyEdit(next)`, which records the
    previous total for Review plan's "changed by" figure. Views get these as actions from
    `useWorkspace`, never as state setters ([architecture](architecture.md#workspace-state)).
- **Storage.**
  - Everything is saved in the browser only, with a debounced autosave state in the sidebar.
  - The catalog (`trip-workspace-catalog-v3`) keeps conversations and trips separately, with stable
    links and an optional conversation `draft`. Snapshots write version 4; version 3 (AUD) snapshots
    remain readable and recover their budget source when the draft still matches the plan.
    Pre-AUD versions 1 and 2 remain rejected; the catalog version and storage keys stay unchanged.
  - Layout stores the sidebar's `collapsed` always and its `width` only after a resize, so an
    untouched workspace keeps following the stylesheet at every viewport size.
  - Corrupt data is never overwritten automatically, and layout fields fall back to defaults instead
    of making history unreadable.
  - When storage is full or unavailable, the plan stays in memory with a visible retry.
  - Every planned trip is kept in the catalog automatically, so there is no separate Save trip
    button or saved-snapshot list. Snapshots left under `trip-saved-v1` by the retired button are
    neither read nor deleted; see
    [workspace catalog trip storage](../.agents/notes/implemented/architecture/2026-09-24-workspace-catalog-trip-storage.md).

## Reviewing a plan

Names of removed surfaces below appear only to explain their removal; nothing in this section
describes current behaviour except the absences.

- **There are no decisions to approve.** `HitlCheckpoint`, `TripPlan.hitl`, the checkpoint cards, the
  approve/reject/defer actions and `POST /api/hitl` are all removed. The app cannot apply a
  traveller's decision yet, so it does not ask for one: presenting a list of things to confirm would
  offer a capability that does not exist.
- **What the plan does decide is reported, not asked.** The accommodation specialist compares every
  eligible candidate and names one; the transcript shows that choice with the alternatives it
  compared, and the Trip drawer shows the sections and their cost. A traveller who wants a different
  flight or stay picks it from that section (see [Trip sections](#trip-sections)); anything else is
  said in chat or edited in the Trip drawer's day view.
- **Conflicts are information.** When the orchestrator detects a conflict it retries the affected
  sections within its round budget, and anything still unresolved stays visible on the plan rather
  than becoming a card that waits for an acknowledgement nothing can record.
- The client is not a source of supplier facts: totals are recomputed from proposal items, and
  results are labelled as SerpApi live search, Google Places estimates or simulated fixtures. None
  of them creates a reservation.

## Trip sections

Below the day view the Trip drawer shows each specialist's section (`TripSection`,
`ProposalDetails`).

- **Getting around** lists every movement of the trip, grouped by day and ordered by arrival: the
  flight in, the hops between cities and the legs between a day's stops (`dayConnections`). The Day
  plan section shows places and times only, so each leg appears once. Getting around can list legs
  on a single-city trip whose transport specialist returned nothing; its summary line still counts
  only that specialist's items. See the
  [Agent Note](../.agents/notes/implemented/architecture/2026-10-07-intra-city-legs-in-getting-around.md).
- **Flight card.** Each flight the plan priced shows its carrier, departure, travellers, stops
  ("Nonstop" when none) and flight time. A plan whose flight no longer matches a selection says
  "This flight needs a new selection." The stay card shows the chosen hotel's rating, check-in and
  check-out, rooms and nights, nightly price and cancellation terms.
- **Also found.** Both cards list the alternatives the chosen flight or stay beat, each with its price and
  its difference from the chosen one; a cheaper difference is green and also carries a minus sign.
- **Choosing another.** Each Also found row is a button ("Take … instead, …", at least 44 px tall
  under a coarse pointer). Pressing it applies at once, with no preview: it sends a `choose` edit
  through `POST /api/trip/preview-edit` ([API](api.md#post-apitrippreview-edit)), so the server
  rewrites the item's sentence, the section cost and the plan total. Taking the earlier option back
  is another choice from the same list. While another change is in flight the rows are plain text. A failed swap shows a notice
  in the Trip panel, and a response that arrives after the traveller opened another plan is
  dropped. Plans saved before items carried a `selectionId` cannot be re-priced and must be
  replanned. See the
  [Agent Note](../.agents/notes/implemented/architecture/2026-10-07-selection-id-on-proposal-items.md).

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
  - It reframes only on a trip or destination change. Drag, zoom and Show my location count as
    user moves and are never taken back.
  - No Google map is created before there is somewhere to show; a neutral placeholder is shown
    instead. Container resizes keep the centre.
- **Markers** (`components/map/map-layers.ts`, `lib/map/place-category.ts`). Each located stop is a
  numbered badge in its day's colour (`--day-1` … `--day-7`) on the place with a label pill beside it: a category icon from Google's
  `primaryType` and the place name, cut to 22 characters (26 when selected). Stop numbers come from
  the Itinerary (`lib/trip/itinerary.ts`), the one reading of the plan that the maps, the Trip
  drawer, the timeline, the phone map and the Trip button share
  ([Agent Note](../.agents/notes/implemented/architecture/2026-10-06-one-itinerary.md)): numbers are
  trip-wide, one per place in visiting order (day, then start time, then plan position), and a
  place visited again keeps its first number. Ideas (activities without a day) are never numbered,
  counted or mapped. Below zoom 12 only the selected stop keeps its label,
  and when the map settles a label that would overlap one already shown is hidden (the selected stop
  wins, then visiting order). Markers never load place photos.
- **Itinerary lines** (`lib/map/itinerary-route.ts`, `components/map/map-layers.ts`). Each day's
  stops are joined in visiting order. A leg follows a verified Google Routes polyline when one exists
  for that exact pair of places; otherwise it is a gentle arc (`curvedPath`, a quadratic curve in
  Web Mercator bending to the left of travel), so a day reads as one flowing path rather than a
  zig-zag. No route is requested just to draw a line. The focused day (the selected stop's day, or
  every day when nothing is selected) is drawn Apple Maps style in its day colour over a
  `--route-casing`, with a white chevron at the middle of each leg pointing to the next stop and
  white dashes flowing from stop to stop; other days are a thin static `--text-dim` line. The dashes
  move in one `requestAnimationFrame` loop throttled to about 30 frames a second, which stops when
  the lines are redrawn or the map unmounts. Under `prefers-reduced-motion: reduce` the dashes are
  drawn still and no loop runs. Verified routes that are not an itinerary leg, such as an edit
  preview, stay solid lines. The map follows the system light or dark scheme.
- **Place popup.** Pressing a marker or its label, or a place in the Trip drawer, opens the place's
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
- **Trip drawer.** One view, with no tabs: heading and summary, budget, then the day view: the day
  strip, the chosen day's stops in visiting order with the number their place carries on the map (a
  repeat visit keeps it), then Ideas, unnumbered. The trip sections and Review plan follow. The phone
  Trip tab shows the same view.
- **Stop menu** ([Agent Note](../.agents/notes/implemented/feature/2026-10-08-one-day-trip-view.md)).
  Each stop's "…" menu (`ActionMenu`, a `role="menu"`; arrow keys move, Escape closes it and returns
  focus to its trigger without closing the drawer) offers Move earlier and Move later (not on the first
  or last stop of a day), Move to another day (opens a day picker in the place card), Move to ideas,
  Replace place (opens the place search in the card), Edit details, Add or Edit note, Mark as booked and
  Remove. An idea offers Schedule on a day instead of the moves. Moves, Ideas, details, notes, booked and
  Remove apply in the browser at once. Move earlier and Move later swap the stop with its neighbour on the
  same day: each takes the other's start time and keeps its own duration, the second starting later if the
  first would overlap it, and a swap that would end past 23:59 or overlap the next stop is refused with a
  message. Move to another day puts the stop after that day's last stop. Undo offers the last such change
  until the next plan arrives from chat. A move changes the day's times, so the day's legs are routed again (see Legs under Timeline editing). At
  phone width (520px and below) the menu's trigger and items are at least 44 px. Missing or zero budgets
  state that no budget is set; invalid totals never render `NaN`, a negative bar, or a bar wider than its
  container.
- **Location.** When the workspace opens it asks in its own words, in the notices strip, whether to
  show the traveller's location (`components/map/useUserLocation.ts`, `LocationPrompt`). The
  browser's permission prompt appears only after Allow location or Show my location is pressed.
  Not now is remembered in this browser (`trip.locationPrompt`) and the question does not return;
  after an Allow that the browser still grants, later visits show the position without asking. The
  question is skipped when the browser already blocks location. Denied, unavailable, timeout and
  unsupported cases are explained on the map. Only the answer is stored: the position stays in
  memory and is never saved or written into the plan. Route from my location requests a verified
  duration and distance for the selected place. See the
  [location prompt Agent Note](../.agents/notes/implemented/feature/2026-09-24-location-prompt-and-itinerary-map.md).
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
the client applies an accepted one at once. Moves, Ideas, details, notes and booked apply in the
browser, as the Itinerary list did. The checks are deterministic and make no LLM calls.

- **Layout.** A day strip of tabs (`Day 2 · Sun, 18 Oct · 3 stops`, flagged when a stop needs a
  place) picks the day. The day is a vertical line in time order (`lib/trip/timeline.ts`): an
  untimed flight first, timed inter-city hops and stops by start time, the night's check-in last,
  and "Staying at …" on later nights. Fixed rows show an icon, a title, one detail line and their
  cost ("Fare not published" or "Price unknown" rather than AUD 0). Between two stops the journey
  is a leg (see Legs below): its mode and duration, marked "checked" when the provider verified it and
  "estimate" when it is the planner's `arriveBy` or a simulated fixture.
- **Prices.** No provider publishes admission prices, so itinerary stops carry no `estCost` and show
  "Price unknown"; the budget card adds "Not included: admission for N stops with no published
  price" so the total is not read as the whole cost.
- **Order and numbers.** A day's stops are listed in visiting order, and each stop's node shows its
  trip-wide stop number, the same as on the map and in the Trip drawer; an unlocated stop shows
  none. Move earlier, Move later, Move to another day and drag and drop name a position as shown;
  the Itinerary turns it into the plan index `preview-edit` expects, which counts the day's other
  stops in plan order. When start times disagree with plan order, a stop moved later lands just
  after the stop it moved past and any other move lands just before it, so the preview keeps the
  swap the traveller asked for; the endpoint then re-times the rest of the day after it.
- **Time and place.** Tapping a stop's time opens its Start and End form; "Change time" sends the change
  to the server check. Selecting a stop, here or on the map, opens its place card: the place's first
  photo (live data with a Maps key), rating, address and an Open in Google Maps link. Replace place in the stop's menu opens a
  Google Places search in the card; a picked result is saved through the server check. Escape closes an
  open form or the card and returns focus to the stop. Drag and drop still reorders the day.
- **Editing.** A stop is compact until selected, here or on the map; selecting it opens its editor:
  start and end time ("Change time"), Move earlier / Move later, Move to another day, and a
  Google Maps search to replace the place. Drag and drop still reorders the day.
- **Places from the map.** When the map finds a stop's place by name and the stop has no saved
  place, the workspace saves that place on the stop itself, once, through the immediate place edit
  below; no traveller action is needed. While it is being saved the stop reads "Saving place…"; a
  save the server does not accept reads "Place not saved yet" and the card says to search for the
  place. A stop the map cannot find reads "Not found on the map", and its card offers a search that
  saves the picked result. A lookup that failed for a retryable reason is not saved; "Retry places"
  on the map runs it again. Saves run one at a time and wait while chat or another edit is running.
  The traveller replaces a saved place from the card's search.
- **Legs.** Each journey between two stops of a day is a leg ([Leg](../GLOSSARY.md)). There is no button:
  a day's legs are routed once every stop on it has a confirmed place, and again whenever an applied
  edit changes its stops or times. Changing one leg's mode (a select with Walk, Public transport or
  Drive; "Not checked yet" until the leg has a mode) routes that leg alone; the rest of the day is
  re-timed with the stored times of its other legs. The chosen mode is kept through later re-timing,
  and Undo restores the previous mode. A leg the traveller has not chosen walks when the walk takes
  20 minutes or less, and otherwise uses public transport when the provider finds one.
  A leg with no route between its two places reads "No route found" and adds no time to the day.
  A provider outage refuses the edit that needed the route and shows a notice; the plan stays as it
  was. In mock data mode the server answers with fixture legs marked "estimate", never "checked".
  A reload shows the stored legs as estimates, and a "No route found" result is not kept across a
  reload. Confirming a stop's place still needs a Maps key or a stub.
- **Applied at once.** An edit applies as soon as the server accepts it, with no review step. A
  refused edit leaves the plan unchanged and lists its blockers as an alert above the day. A place change
  on a day with an unconfirmed neighbour is accepted: that pair has no route until both places are
  confirmed, and other edits on such a day are refused until every stop has a place. An applied edit
  shows "Undo last change", which runs the same check and applies the same way. A plan that arrives from
  chat clears the undo step.
- **Motion.** A day's list fades in when the day changes; a stop's place card rises in; an applied edit
  washes the stops it changed with the accent for a moment; a leg the provider verified draws down
  the line. Each has a text or colour signal too, and none plays under reduced motion.
- While an edit is pending the chat composer cannot send (`ChatPanel` `locked`), but the chat shows
  no thinking row or stop button: a pending edit is not a chat request.

- Activities receive stable IDs once, retained on reorder and restore. `editVersion` is independent of
  the orchestrator round, and an edit applies only if its base version still matches.
- Moves, time changes and place replacements preserve activity duration. Following activities start
  at the later of their original start or previous end + route duration + 15 minutes. Empty target
  days start at 09:00 local, and moves stay within the same lodging destination segment.
- A provider outage on a leg blocks the edit that needed it, so no time is shifted on a guess; a leg
  with no route adds no travel time. Overflow beyond the day blocks apply. Fixed transport and stays are read-only, and overlaps stay visible in review.
- Replacing a place marks the activity price for verification. Route fares are separate estimates,
  never added to transport twice, and an unknown fare is not zero.
- Edits invalidate itinerary and final confirmation and regenerate conflicts, keeping unaffected brief
  and hotel decisions. Undo revalidates instead of restoring old approvals. Chat replanning replaces
  manual activities.
- Routes use real local departure times from the Google Time Zone API; ambiguous or nonexistent DST
  times are rejected. Transit queries respect Google's supported departure window.
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
first render; without a browser key the map shows a fallback and the itinerary stays usable.

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
run, so shapes line up and a shorter run ends earlier; a strategy that never ran has no bar. The
[trace end-to-end script](../apps/web/tests/e2e/agent-lab-trace.e2e.mjs) checks it at desktop and phone width.

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
  the left, with an ink bar beside the chosen section; on a phone it becomes a scrolling row with the
  bar underneath. The chosen section's rows fill the right. Each row has a label and value, and
  Change opens its editor in place. **Account settings** opens Your account and **Personalization**
  opens Personalization. Mindtrip's Voice, Price
  alerts, Notifications and Cookie preferences have no counterpart here.
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
    - **Long-term memory** switch. Off, the assistant neither records nor uses what it learns in
      chat.
    - **What the planner knows**, grouped as in Mindtrip:
      - Identity: home base.
      - Travel party: travellers.
      - Travel style: pace and interests.
      - Food: dietary needs.
      - Budget: whole-trip budget in AUD.
      - Accommodation: loyalty programmes.
      - Other preferences: standing preferences.

      Each fact is a filled row with an emoji and bold label; clicking it edits the fact. An empty
      fact shows its question on an amber-edged row with Answer. A new chat or trip starts from these
      facts: home base as the origin, plus travellers and budget, with pace, interests and dietary
      needs as trip preference lines. A new chat counts as blank while its facts equal these
      defaults.
  - **Language & region:** interface language (English or Simplified Chinese; chat in any language), region, display currency (AUD, CNY, USD or JPY; default AUD), units (metric), and Trip data (the site's default, live prices or sample data)
    under Advanced.
    The top-bar language switch sits beside Mock data and updates the same saved language setting.
    Authored chat controls, timeline and proposal labels, settings, notices, dialogs, accessible
    names and dates follow it. Traveller text, agent-produced content and provider errors are not
    translated. Authored text that carries a value (the attachment limit, a timeline edit preview's
    differences and blockers, a stop that cannot move) is translated with `{placeholders}`, through
    `t()` or as a keyed `Notice` (`apps/web/lib/i18n/notice.ts`) that the view translates once when it
    is shown. Every notice the workspace and Settings show is a `Notice`: field errors, request and
    storage failures, map and location messages, and the `notice` the app's own routes return beside
    their English `error`. A response whose body has no `notice` is shown as received (`{ raw }`);
    one with no readable body shows "Request failed ({status})." Nothing matches English text back to
    a key. Edit preview differences arrive as values, not sentences. With no saved choice it follows the browser language (`zh*` opens in Chinese). The desktop sidebar and main content have an 8 px gutter.
    Every workspace amount goes through the Money module (`apps/web/lib/money.ts`, read through
    `useLocale()`) and the shared approximate rate table. Converted displays carry its as-of date;
    JPY has no decimals, other currencies have two. The trip's effective currency
    (`displayCurrency`, else the stated budget currency) takes precedence over Settings. Planning and guardrails keep AUD values. `money()` converts a planning
    amount; `fare()` keeps a provider-native fare in its own currency with that currency's decimal
    places, grouping thousands from four digits up (`JPY 230`, `AUD 12.50`, `KRW 1,400`), and never
    converts it; `delta()` signs a
    difference (`+AUD 12.00`, `−AUD 30.00`, no sign on zero); `budgetGap()` gives the one
    "{amount} under/over the {budget} budget" sentence the trip panel and edit preview share.
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
| Overlays        | Navigation and Trip drawers, chip editors; close, Escape, and focus return           |
| Content         | Empty chat/map, planning and failure states, long messages, and available map places |
| Native controls | Date, select, checkbox, and scrollbar follow the active color scheme                 |

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
