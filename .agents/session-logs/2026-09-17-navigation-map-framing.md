# Workspace navigation, map framing and blank start

## Session summary

- Author: Claude Code (Opus 5)
- Date: 2026-09-17
- Baseline: `codex/ui-improvements` at `fd92058`. `git fetch` showed no difference from `origin/codex/ui-improvements`, and `origin/main` (`19a1bff`) was already contained, so no sync was needed.
- Modules: `apps/web/components`, `apps/web/lib`, `apps/web/app`, `apps/web/public/brand`, docs.
- Goal: brand logo and collapsible icon navigation, a real workspace top bar for Preferences and Trip, no automatic demo plan, reliable place lookups, and map framing that centres on the trip destination.
- Contract impact: no `packages/shared` change. `/api/demo` was removed. `/api/places/search` accepts an optional `destination` and now returns 400/429/502 instead of a blanket 400. `/api/places/details` returns 404/429/502. The catalog layout gains an optional `sidebar.collapsed`, and layout fields fall back per field instead of rejecting the catalog.

## What changed

- **Logo**: `/Users/joey/Downloads/ai-trip-planner-logo.svg` was copied byte-for-byte to `apps/web/public/brand/ai-trip-planner-logo.svg` and is referenced by URL from `BrandMark` (32×32, `object-fit: contain`). Its alt text is empty next to the product name and “AI Trip Planner” when shown alone. The favicon was not replaced, because the asset is 837 KB.
- **Sidebar** (`WorkspaceSidebar`, `icons.tsx`):
  - Logo and name at the top.
  - New chat, Search, Chats, Trips and Saved trips, with line icons on tinted backgrounds.
  - Chats/Trips switch the history list, show count badges, and mark the current item with `aria-current`, a filled icon, bold text and a bar.
  - Language and Local account sit in the footer.
  - The sidebar collapses to 64 px with `aria-label` + tooltip on each icon and an `aria-expanded` toggle. The preference is persisted.
  - History select, search, rename and delete are unchanged.
- **Top bar**: the global Header was removed. A 60 px workspace top bar sits right of the sidebar and shows the destination with its days, travellers and budget (only real plan values), plus Preferences and Trip, with Trip rightmost and showing its pending count. Drawers and the backdrop live in the chat/map area below it. Google's fullscreen control is disabled.
- **Narrow screens (≤1000 px)**:
  - The top bar keeps a menu button, the trip summary, Preferences and Trip on one row, with a Chat/Map switch below.
  - Navigation opens as a drawer.
  - Preferences and Trip drawers span the content width.
- **Blank start**:
  - `/api/demo` and `lib/demoPlan.ts` were deleted. `Workspace` never fetches a demo.
  - `restoreWorkspace` never reopens a trip. It continues the active blank chat, or reuses an untouched blank chat, so refreshing does not pile up empty “New chat” records.
  - Saved Chats/Trips open only when chosen.
  - The “Restore last workspace” action moved from the removed My trips dialog into Saved trips.
  - The blank form's minimum rating defaults to `0` (the schema default, meaning no minimum).
- **Place lookups** (`lib/place-query.ts`, `useTripPlaces`):
  - Lookup priority is saved `placeId`, then the activity's `location`, then a title that is itself a proper place name.
  - Descriptive prose and mock placeholders (“Mock attraction near …”) are never sent to Places.
  - Destination cities are looked up separately.
  - Results are applied one by one. Failures are classed as “no confirmed place” (not retried) or retryable (429, 5xx, network).
  - The map shows a compact status instead of a blocking error, and Retry places re-queries only retryable failures. The timeline shows “Location to be confirmed”.
- **Map framing** (`lib/map-view.ts`, `TripMap`):
  - The map frames the destination first: a single city at zoom 12; multiple cities with `fitBounds` capped at zoom 12, widened as each city resolves.
  - Once activity markers exist, it fits them once, capped at zoom 15.
  - After that it reframes only when the trip or destination changes or on View all places. Dragging, zooming and Show my location count as user moves and are never taken back.
  - Programmatic moves are flagged until `idle`.
  - No Google map is created before there is somewhere to show; a neutral placeholder is shown instead.
  - Container resizes keep the centre.

## Automated verification

- `pnpm build`: passed; `/api/demo` is no longer in the route list.
- `pnpm typecheck`: passed, 6 tasks. Stale generated `.next*/types` for the deleted demo route were removed before the first typecheck.
- `pnpm lint`: no ESLint warnings or errors.
- `pnpm test`: 230 tests passed (web 85, orchestrator 43, agents 74, tools 28).
- New or updated tests cover:
  - First open never calls `/api/demo` and is blank.
  - New chat is blank.
  - Refresh does not reopen the last trip, but choosing it from history restores its form and input.
  - Sidebar collapse, labelled icons, focus kept on the toggle, persistence after remount, and Search expanding and focusing.
  - Corrupt layout falls back without an alert.
  - The top bar is outside the chat/map shell and Trip is its last action; drawers sit inside the shell.
  - Descriptive activity text triggers only the city lookup.
  - One failed lookup keeps other markers, and Retry re-queries only the failed name.
  - An unlocatable destination shows a placeholder and keeps the plan.
  - Framing unit tests: single city, multi-city widening, one-time place fit, user move respected, trip switch and View all places, and no move when nothing resolves.
  - Place-query strategy and the logo asset/alt text.

## Browser acceptance (local dev server, dark theme)

- **Desktop 1600×900, first open**:
  - No `/api/` request was made on load.
  - The top bar showed “New trip / Not planned yet”, with an empty chat input and the map placeholder “Your map will appear here”.
  - The logo loaded (1536×1536 source rendered at 32×32).
  - `scrollWidth` = 1600.
  - Closed drawers sat at x −448…−48 and 1648…2640. The top bar spans y 0–60 and chat/map start at y 60.
- **Sidebar**:
  - Collapsing gave 64 px with no visible text; the logo alt switched to “AI Trip Planner” and all eight icon buttons were labelled.
  - The hover tooltip “Trips” was shown and focus stayed on the toggle.
  - After reload the sidebar was still collapsed. Clicking the Trips icon expanded it with Trips current.
  - No overflow at any point.
- **Lisbon (existing trip)**:
  - The only Places request was `{"text":"Lisbon"}`; all four activities have mock locations and prose descriptions.
  - The map centred on Lisbon at city zoom with a small “4 activities have no confirmed place yet” status and no alert.
  - After a manual wheel zoom-out, opening and closing Trip left the view unchanged. View all places reframed Lisbon.
- **Trip drawer**:
  - Spanned x 608–1600, y 60–900, did not cover the logo or top bar (a hit test on the Trip button still returned it), and the map stayed 782 px wide.
  - Focus moved to Close, then returned to Trip. When closed it moved fully to x 1648.
- **Preferences drawer**: spanned x 240–640 from y 60, with focus on its close button.
- **Tokyo & Kyoto**: both cities were queried. After the incremental-framing fix, the map framed both cities.
- **Real planning**: a new chat with Preferences “Kyoto, 2026-11-10 to 2026-11-13, 2 travellers, USD 1,800” produced a plan. The top bar read “Kyoto · 4 days · 2 travellers · USD 1,800.00 budget”, the map centred on Kyoto, and the chat was renamed and linked to the new trip.
- **Narrow**:
  - 375×812: the top bar is 100 px, with menu, summary, Preferences and Trip on one row (Trip at x 323–363) and Chat/Map below. Map view is full width, the navigation drawer opens below the top bar with a working close button, and `scrollWidth` = 375.
  - 768 px and 1100 px also had no horizontal overflow.
- **Console**: after a sentinel log, a full reload → open trip → Trip drawer → collapse/expand → New chat pass produced no errors. Earlier errors in the log came from Fast Refresh while files were being rewritten.

## Found and fixed during acceptance

- Multi-city destinations framed only the first city to resolve. Framing now widens as more cities arrive.
- Refreshing with a trip open added a new empty chat each time. Untouched blank chats are now reused.
- The narrow top bar wrapped Preferences/Trip to the left on a second row. It now uses a grid with Trip rightmost.
- A blank Preferences form could not be submitted without typing a minimum rating (raw “expected number, received NaN”). The field now defaults to `0`.

## Boundaries and not covered

- The Browser pane's key automation does not send real Enter/Escape keys, so Escape layering was verified by unit tests rather than in the browser.
- Actual Google map centre/zoom values are not readable from outside the SDK. Framing was verified with screenshots plus SDK-free controller tests.
- The local itinerary uses mock tools, so no activity in the tested trips had a real place name. Activity marker fitting with real names is covered by tests, not by live Google data. Two chats that were blank before the minimum-rating default change remain in local history.
- Geolocation permission and Routes from location were not exercised live in this session; their existing tests still pass.
- Light theme was not visually re-checked; the pane ran in dark mode.
- The 837 KB logo is served as a static file; no favicon, WebP or PNG derivative was generated.
