---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-289-sign-in-polish
pr: none
area: apps/web, packages/agents, packages/orchestrator
contract-impact: none
---

# Sign-in card names the app and the passcode block joins the card

## What changed

- `apps/web/app/layout.tsx`: `ClerkProvider` localization sets the sign-in title to "Sign in to
  AI Trip Planner"; Clerk's application name is lowercase "ai trip planner".
- `apps/web/app/styles/auth.css`: after the Clerk form, the admin passcode block uses the Clerk
  form's side inset, one top divider and a label styled like Clerk's field labels.

## Why

UI loop round 2 (2026-11-02): production sign-in showed the lowercase name, and the passcode block
was wider than the Clerk form with a grey meta-size label, so it looked bolted on.

## Validation

- Preview on production via injected CSS and title at 1440 px and 390 px.
- `tsc --noEmit` in apps/web: clean.
- No machine check: copy and spacing, not a bug class a lint or type can catch.

## Round 3: TP-290 placeholder chat titles in Chinese

- `apps/web/lib/workspace/catalog.ts`: `conversationTitle` translates the stored placeholder titles
  "New chat" and "New trip" unless the traveller renamed the chat. The top bar showed "New chat" in
  Chinese because only `ChatsPanel` translated them.
- Check: `tests/lib/workspace/catalog.test.ts` asserts the zh title; on the old code it fails with
  `expected 'New chat' to be '新聊天'`.
- Local dev at 1440 px and 390 px, zh: header reads 新聊天.

## Round 4: TP-291 short calendar events cut their time in half

- `TripHomeCalendar.tsx` marks a timed slot `data-size="short"` under 90 minutes and `"tiny"` under
  45; `trip-home-calendar.css` clamps the title to one line there and hides the time on tiny slots.
  At 44 px an hour, a 60-minute lunch with a two-line title showed only the top half of "12:15–13:15".
- Local dev week view at 1440 px, zh: lunch blocks show one title line and the full time.
- No machine check: clipping depends on rendered text height, which no lint or type sees.

## Round 5: TP-292 transport route repeated the first city

- `packages/agents/src/summary-copy.ts`: the transport line drops "origin ↔" when the origin is the
  first destination (the fallback when no origin is known), so "东京 ↔ 东京 → 京都" reads "东京 → 京都".
- Failure inventory added to `packages/agents/tests/summary-copy.failures.md` before the code.
- Check: `summary-copy.test.ts` expects "2 transport options for Tokyo → Kyoto" with origin
  " tokyo"; on the old code it received "for  tokyo ↔ Tokyo → Kyoto". Agents suite: 211 passed.

## Round 6: TP-293 phone map sheet rows painted as grey buttons

- `apps/web/app/styles/phone/map.css`: the sheet handle and stop rows set `--button-bg:
  transparent`. Their own `background: transparent` lost to the generic button rule in
  `forms.css`, whose long `:not()` list gives it a higher specificity than any component rule.
- Local dev phone Map tab at 390 px, en: header and rows have no grey fill.
- No machine check here; the cause is the generic rule's specificity. Wrapping its `:not()` list
  in `:where()` would let every component rule win, but it touches every button in the app and
  needs a full visual pass, so it is left as a follow-up.

## Round 7: TP-294 fallback reply listed every repeated stop

- `packages/orchestrator/src/chat/reused-places.ts`: `reusedPlacesNote` keeps the one-stop sentence
  and folds several repeated stops into one sentence (count, first three with days, "and N more").
  `chat.ts` fallback reply uses it. An 8-day mock trip printed nine near-identical sentences.
- Failure inventory `tests/reused-places-note.failures.md` written first; check
  `tests/reused-places-note.test.ts`. On the old code the note module does not exist, so the check
  fails at import. Orchestrator suite: 435 passed.

## Notes for the next person

- The sign-in page copy is English only; the workspace language setting does not reach it yet.

## Round 8 — TP-295 team avatars overlap

- The top-bar team button stacked three 20px avatars with an 8px overlap, which hid half of the coordinator sparkle and the route icon in light and dark themes.
- `apps/web/app/styles/chat/thinking.css`: overlap reduced to 4px, so the overlap only covers the avatar padding.
- Validation: element screenshots at 1440px, light and dark, show every icon in full. No machine check: the repo has no CSS geometry check, and adding CI wiring touches protected files.

## Round 9 — TP-296 trip card details wrap mid-item

- Trips page card (1440px, en): the detail line wrapped anywhere and split "5 days" into "5" / "days".
- `lib/workspace/trip-identity.ts`: `tripMetaParts` returns the details as a list; `tripMeta` joins them as before.
- `TripsPage.tsx` renders each part in `.trip-card__meta-part` (`white-space: nowrap` in `workspace/trips.css`), so the line breaks only at the dots.
- Validation: card screenshot after the fix; `tsc --noEmit`, eslint, workspace lib tests (103) pass. No machine check: wrapping depends on rendered width.

## Round 10 — TP-297 return flight route in the calendar

- Trip calendar week view (1440px, zh, mock Perth → Bali trip): the last-day return flight read "珀斯 → 巴厘岛", the same as the outbound. The day timeline (`BookingRow`) already reversed it; `lib/trip/calendar.ts` built its own label and did not.
- `lib/trip/timeline.ts` gains `flightRoute(flight, role)`; the calendar and `BookingRow` both call it.
- Machine check: `tests/lib/trip/flight-route.test.ts` (inventory `flight-route.failures.md` written first). On the old code it fails with `TypeError: flightRoute is not a function`.
- Validation: calendar screenshot shows "巴厘岛 → 珀斯" on the last day; `tsc --noEmit`, eslint on changed files, `tests/lib/trip` pass.

## Round 11 — TP-298 calendar all-day flight chips

- Week calendar (1440px, zh and en): flight chips sit under the "All day" heading but their meta line said "All day" again, and the 110px columns broke "巴厘岛" as "巴厘" / "岛".
- `TripHomeCalendar.tsx`: an untimed flight or stay shows its own detail ("Flight", "Return flight", night index) instead of repeating "All day"; untimed activities keep "Untimed".
- `trip-home-calendar.css`: event titles use `word-break: keep-all`, so CJK place names wrap between words; `overflow-wrap: anywhere` still breaks a word that cannot fit.
- Validation: zh and en calendar screenshots; `tsc --noEmit`, eslint, `check-ui-copy` pass. No machine check: wrapping depends on rendered width, and the label change is copy.

## Round 12 — TP-299 phone month calendar

- Month view at 390px (zh, mock Perth → Bali trip): every event was a 44px-tall chip whose text was cut to "M…" or "珀…", so the trip week was a tall column of unreadable boxes.
- `trip-home-calendar.css` (≤520px only): month events become 7px dots in their category colour, laid out in a wrapped row under the date; titles stay in the accessibility tree (visually hidden), and the dots take no taps, so the 44px date button stays the way into a day. Desktop month view is unchanged.
- Validation: phone month screenshots in light and dark. The existing phone hit-area check in `trip-home-calendar.e2e.mjs` measures the week view, which is unchanged. No new machine check: the change is layout at one breakpoint.

## Round 13 — TP-300 month view repeats the hotel

- Desktop month view (1440px, zh, mock Bali trip): the hotel chip was drawn on every night, so each trip day started with the same "Mock 巴厘岛 Standard" chip.
- `TripHomeCalendar.tsx`: month cells pass `continuedStays` (stay titles the previous visible day in the same week row already showed) to `CalendarEntries`, which leaves those out. A stay shows where it starts, on each Monday and on the first day of a month page.
- Validation: November and December month screenshots (hotel on 28 Nov, 30 Nov and 1 Dec only); `tsc --noEmit`, eslint pass. No machine check: rendering rule in one view, covered by the screenshot.

## Round 14 — TP-301 memory switch shows on when signed out

- Settings > Personalization (1440px, en, signed out, default settings): the long-term memory switch was drawn on (disabled) beside "Sign in to use long-term memory." and "Nothing is remembered yet." The stored default is `memory: true`, and the switch showed the stored value even though memory never runs without sign-in.
- `SettingsDialog.tsx`: the switch shows `signed-in && memory`; the signed-out "Nothing is remembered yet." line is dropped. The stored preference is untouched.
- Machine check: `tests/e2e/settings.e2e.mjs` now seeds `memory: true` (the real default) and asserts the signed-out switch has `aria-checked="false"` and the stored value is kept. Old code: `FAIL desktop/phone: signed-out users see a disabled, off memory switch and sign-in hint`; new code: all ok.

## Round 15 — TP-302 bookings tab detail copy

- Trip home Bookings tab (390px and 1440px, zh): flights read "2 出行人数" (a heading label glued to a number) and stays read "1 / 6 房间数 / 晚数".
- `TripHomeIdeasBookings.tsx`: flight and stay details use the existing plural messages (`countTravellers`, `countNights`, `stayRoomRate`), and are passed as a list rendered in nowrap parts (`trip-home-ideas-bookings.css`) so "1 间房" does not split. The now unused `roomsNights` message is removed from both dictionaries.
- Validation: zh and en phone screenshots; `tsc --noEmit`, eslint, `check-ui-copy` pass. No machine check: the copy came from picking the wrong message key, which types allow.

## Round 16 — TP-303 English route-time warning on the day timeline

- Trip home 日程 tab (390px and 1440px, zh, mock Perth → Bali trip): day 1 showed the planner's raw sentence "geography conflict on day 1: Mock attraction near 巴厘岛 to Mock Corner Bistro, 巴厘岛 needs 35 minutes including a 15-minute buffer but only 15 are available" in English.
- `lib/trip/conflicts.ts`: `placeConflicts` reads that sentence into a `routeNeedsMoreTime` notice on its day (from, to, required and available minutes); en and zh messages added. Other geography conflicts are placed as before.
- Machine check: `tests/lib/trip/route-time-conflict.test.ts` (inventory `route-time-conflict.failures.md` written first). Old code: `AssertionError: expected { Object (raw) } to deeply equal { key: 'routeNeedsMoreTime', …(1) }`; new code passes with the rest of `tests/lib` (410).

## Round 17 — TP-304 English "route provider" warnings

- When the maps provider fails (production has no working Google key), the day timeline showed raw planner sentences: "geography conflict on day 1: route provider failed" and "… route provider unavailable for A → B". The planner's "route provider failed; connection unverified" was also cut at "; ", so "connection unverified" fell to the budget area as its own raw line.
- `lib/trip/conflicts.ts`: the failed-provider sentence becomes the existing `routeCouldNotBeVerified` notice on its day (its "connection unverified" tail is dropped), and "route provider unavailable for A → B" plus the "A to/→ B: no route returned / invalid route … / driving estimate …" sentences become a new `routeBetweenNotChecked` notice naming both stops. Unknown geography sentences still show raw on their day. A second new message key tipped `Notice` over TS2590, so the failed-provider case reuses the existing key.
- Validation: phone screenshots with these sentences seeded into the mock Bali plan (before raw English, after "路线没法核实。" / "没能核实从…到…的路线。"). Machine check: the "unchecked routes" cases in `tests/lib/trip/route-time-conflict.test.ts` (inventory extended first): 5 failures on the old code, e.g. `AssertionError: expected { Object (raw) } to deeply equal { key: 'routeBetweenNotChecked', …(1) }`; `tests/lib` 415 passed on the new code.

## Round 18 — TP-305 weather card lists every date

- Trip home 日程 tab (390px, zh, mock Bali trip): with no forecast, the day weather card listed all seven dates ("巴厘岛，11月28日周六、11月29日周日、…、12月4日周五：暂无天气数据…"), six lines on a phone.
- `packages/agents/src/summary-copy.ts`: `weatherUnavailable` sorts the dates and writes a run of three or more consecutive days as "first–last" (en and zh); single days, pairs and gaps read as before, so the one-day English line is byte-for-byte unchanged.
- Validation: phone screenshot of the card with the new sentence (four lines → three, dates on one line). Machine check: "weather unavailable for a run of days" in `packages/agents/tests/summary-copy.test.ts` (inventory added to `summary-copy.failures.md` first). Old code: `AssertionError: expected '巴厘岛，11月30日周一、11月28日周六、…' to be '巴厘岛，11月28日周六–12月4日周五：…'`; agents suite 213 passed and the orchestrator weather e2e tests (8) pass on the new code.

## Round 19 — TP-306 Ideas tab day buttons

- Trip home Ideas tab (390px, zh, dark and light, mock Bali trip): every idea carried seven large grey pill buttons in two rows, so three ideas filled the screen. The generic button rule in `forms.css` (pill radius, grey fill, padding) out-specified the component's bordered day cards, the same cause as TP-293.
- `TripHomeIdeasBookings.tsx`: day buttons get `trip-home-ideas-bookings__day`, which both generic button rules in `forms.css` now exclude, so the designed 8px bordered cards show. `trip-home-ideas-bookings.css`: at ≤520px the day buttons sit in one horizontally scrolling row (edge to edge), and the idea row gets `min-width: 0` so the scroller does not widen the list.
- Validation: phone screenshots in dark and light, desktop drawer unchanged in layout; computed `border-radius: 8px` on the day buttons. No machine check: the class is "generic rule overrides a component rule", which only a cascade-aware check could catch; the structural fix (`:where()` around the generic rule's `:not()` list) remains the open follow-up from TP-293.

## Round 20 — TP-307 phone Settings row

- Scanned every visible button on home, Trips/Mine, trip page and the five trip-home tabs (390px and 1440px) for the generic `forms.css` pill overriding a designed shape. Most pills are intended; the phone Mine tab's 设置与账户 row was not: `phone/polish.css` designs it as a white card (`--radius-xl`, `--phone-card`, bold) matching the trip and chat rows, but it rendered as a grey pill (computed `border-radius: 999px`, `rgba(120,120,128,.1)`).
- `forms.css`: both generic button rules exclude `.phone-mine__settings`. After: `26px`, `rgb(255,255,255)` light / `rgb(28,28,30)` dark.
- Validation: light and dark phone screenshots. No machine check, same cascade class as TP-293 and TP-306; the `:where()` restructure of the generic rule is still the open follow-up that would remove the class.

## Round 21 — TP-308 dialog close button

- Settings dialog (1440px, zh): the × sat at the right edge of a grey 32×36 oval. `trip/trip.css` designs `.dialog__close` as a 32px transparent circle with the icon centred (grey only on hover), but the generic `forms.css` rules added 14px side padding, the grey fill and a 36px minimum height. The button comes from `components/ui/Dialog.tsx`, so every dialog using it had the same close button.
- `forms.css`: both generic button rules exclude `.dialog__close`. After: 32×32, transparent, × centred.
- Validation: before/after crops of the Settings dialog and the measured box (`32×36` → `32×32`). No machine check, same cascade class as TP-293, TP-306 and TP-307 (the `:where()` restructure is the open follow-up).
- Also looked at: desktop trip page and Trips page (light and dark), Settings sections. The desktop trip page's map column stays an empty box with one line when the map cannot place the trip; left for a design decision.

## Round 22 — TP-309 suggestion banner wrapping

- Scanned team panel, trip menu, Trajectory and Trips calendar (1440px and 390px) for generic-rule buttons: only the desktop example chips differ from their CSS (grey fill instead of an outlined chip), left for the `:where()` decision. The English phone trip page (390px) showed the suggestion banner breaking the destination: "5 unscheduled ideas in 巴厘 / 岛"; in Chinese it broke "没排 / 进日程".
- `trip-home-actions.css`: the banner text uses `word-break: keep-all` (with the existing `overflow-wrap: anywhere` as the overflow fallback), so it breaks at spaces: "5 unscheduled ideas in / 巴厘岛", "巴厘岛还有 5 / 个备选地点没排进日程".
- Validation: en and zh banner crops before and after. No machine check: wrapping depends on rendered width.

## Round 23 — TP-310 phone trip panel tabs

- Phone trip panel (390px, en, mock Bali trip): the five tabs need 371px but the row was 300px wide, because the phone rule set the switcher to `width: 100%` of the title box beside the close button. "Calendar" sat off-screen with no scroll hint; on the Ideas tab "Itinerary" had scrolled out of view.
- `trip-home-actions.css` (≤520px): drop the phone `width: 100%` override so the switcher keeps the desktop `calc(100% + 44px)` and runs under the close button (344px), and tighten tab padding to 6px and the gap to 2px. English tabs now measure 344/344px; Chinese tabs keep their spacing with room to spare.
- Validation: en and zh drawer-head crops before and after (scroll width 371 → 344 in a 300 → 344 row). No machine check: fitting depends on rendered text width.

## Round 24 — TP-311 phone map attribution

- Planned mock trips from the example chips (phone zh, desktop en) and read the replies and day cards: no layout fault. Phone Map tab (390px): the map credit ("OpenFreeMap © OpenMapTiles Data from OpenStreetMap") is a top-left control that ran 364px wide under the locate, layers and zoom buttons (top-right, 194px), so most of the credit was hidden.
- `phone/map.css`: the top-left control area on the phone Map panel stops 214px from the right edge, so the credit wraps beside the buttons and stays readable (attribution box 364×24 → 156×64).
- Validation: phone map crops before and after; measured boxes no longer overlap. No machine check: the overlap depends on rendered control widths.

## Round 25 — TP-312 solid modal sheets

- Phone Map tab with no trip (390px, zh, light and dark): opening the Trip details sheet (行程信息) from the title showed the blue "去聊天里规划" button of the empty-map card through the 预算/偏好 rows as a blurred blue blob. The sheet used the 88% glass tint, but it is a modal that already sits on a scrim, so the glass only let content bleed through.
- `glass.css`: the modal fact sheet and `.dialog` set `--glass-fill: var(--surface)`, so they render solid (`rgba(255,255,255,.88)` → `rgb(255,255,255)`, dark `rgba(30,30,32,.88)` → `rgb(28,28,30)`). Floating, non-modal surfaces keep the glass tint.
- Validation: light and dark phone screenshots before and after with the measured sheet background. No machine check: the bleed depends on what is rendered behind the sheet.

## Round 26 — TP-313 Agent Lab controls

- Agent Lab (1440px en dark, 390px zh light; sign-up page phone and desktop). Desktop controls panel: Scenario and Strategy sat at the bottom with an empty band above them, and Data mode sat 21px higher, because the toolbar grid used `align-items: end` against the three stacked action buttons and the taller Data mode block.
- `agent-lab/shell.css`: the toolbar aligns its columns to the top. The selects now share one line (top 319/319/319 at 1440px; the 900px two-column layout keeps its rows).
- Validation: desktop dark crops before and after, 900px light after. No machine check: alignment depends on rendered column heights.
- Also seen: the Agent Lab view buttons and secondary buttons are designed as outlined surface pills but render with the generic grey fill, the fifth instance of the `forms.css` cascade class, left for the `:where()` decision. Agent Lab copy stays English in Chinese locale (left as is).

## Round 27 — TP-314 phone Mine section actions

- Phone home in en dark and zh light, and the Mine tab with the seeded Bali trip. On Mine, "New trip" and "New chat" kept the sidebar row style (`width: 100%` in `workspace/trips.css`). They stretched to 257px and sat just after the Trips and Chats titles, with a grey icon 32px away from a blue label, instead of sitting at the right like the iOS section actions they are styled as.
- `phone/polish.css`: on phone Mine the action sizes to its content (`width: auto`), with a 4px icon gap and the icon in the label's accent colour. Both actions now end at the right edge (x 260–362 en, 275–362 zh).
- Validation: Mine tab before (en dark) and after (en dark, zh light), plus measured boxes. No machine check: placement depends on rendered widths.
- Also checked: the phone top bar's grey band in dark mode is the designed glass bar.

## Round 28 — TP-315 Bookings tab dates

- Phone trip page and every trip panel tab (en dark, seeded Bali trip). The Bookings tab printed raw ISO dates ("2026-11-28 · 2 travellers", "Check-in 2026-11-28 · Check-out 2026-12-04 · 6 nights"), where every other trip view shows "28 Nov" / "11月28日".
- `TripHomeIdeasBookings.tsx`: the flight date and the stay's check-in to check-out use the existing `dateRangeLabel` from `lib/workspace/trip-facts.ts` ("28 Nov · 2 travellers", "28 Nov – 4 Dec · 6 nights"; zh "11月28日", "11月28日 – 12月4日 · 6 晚"). An unparseable date falls back to the old text.
- Validation: Bookings tab text and screenshots before and after in en dark and zh light; `tsc`, eslint and prettier on the file. No machine check: a raw ISO string is a valid string to every type and lint rule, and a repo-wide grep for ISO dates in JSX would flag stored values that are meant to be raw.

## Round 29 — TP-316 Trajectory empty state

- Desktop zh dark with the seeded trip: home, Trips, Calendar, Trajectory. The top-bar data pill appears a moment after load (screenshot timing, not a fault). With no turns, the Trajectory view put its one sentence in the top-left corner of a 840×270 empty panel on desktop, and at the top of the phone Trajectory sheet with "Plan in Chat" under it.
- `phone/shell.css` (the shared `.trajectory-empty` rule): the empty state centres its sentence and button in the panel (phone button y 187 → 489 in an 844px sheet).
- Validation: desktop and phone before/after crops. The walkthrough e2e checks for this state (one sentence, button height ≤ 64px) still hold. No machine check: placement is visual.
