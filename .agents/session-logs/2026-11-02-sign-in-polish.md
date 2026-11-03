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

## Round 30 — TP-317 Bookings group headings

- Desktop trip page (en light, zh dark) and its Bookings panel; phone Bookings tab (en dark). The Flights / Stays headings (`h3`, 20px) computed to weight 400 while the booking names under them were 14px bold, so the headings looked weaker than their own rows.
- `trip-home-ideas-bookings.css`: the group heading is bold (400 → 700), like the other section headings ("Chats · 1").
- Validation: computed weights and desktop zh dark / phone en dark crops before and after. No machine check: the weight is a design choice; the rule only lacked it.
- Also seen: the desktop trip page's five panel tiles leave Calendar alone on a third row, and the map column stays an empty box for mock places; both left as design calls.

## Round 31 — TP-318 generic button rule yields

- Joey chose the root fix on the decision card (2026-11-03 00:02 UTC). The two generic button rules in `forms.css` were `button:not(.a):not(.b)…` chains heavy enough to beat every single-class component rule (five cases this loop).
- `forms.css`: both rules are now `button:where(:not(.a, .b, …))`, with the same exclusion lists, at the weight of `button`. Agent Note `.agents/notes/implemented/bug-fix/2026-11-03-generic-button-specificity.md`; `docs/design/dsh-thinking-ui.md` and its `.zh.md` pair describe the new weight.
- Validation: computed-style census of every visible button in 20 desktop and phone states before and after (`padding`, fill, border, radius, size, weight). The changed classes all move to their own CSS: Agent Lab views and secondary buttons, the "5 ideas" chip, "Day map", trip panel tabs and cards, sidebar rows (38 → 40px), weights 500 → 600 where a component sets 600. Before/after screenshots of Agent Lab, the phone Itinerary tab, the desktop trip panel and the phone home looked right.
- Machine check: `apps/web/tests/styles/forms-button-specificity.test.ts`. On the old `forms.css` it fails with `expected 'button:not(.cl-button):not(.section__…' to match /^button:where\(:not\([^()]*\)\)$/`.

## Round 32 — TP-319 preference checkbox

- Re-ran the button census in zh dark (desktop and phone, 20 states) after TP-318: no button lost its styling, and the dark Agent Lab, trip panel, Trips, Calendar, Mine and Trip preferences screens look right.
- Trip preferences tab: the "不用住宿" checkbox was the 13px browser default, and when ticked in dark mode it was a washed-out system blue. `workspace/trip-facts.css`: `.preference-check input` is 20px with the app accent (`accent-color: var(--accent)`); the 44px label row is unchanged.
- Validation: unticked and ticked crops in light and dark before and after (box 13 → 20px). No machine check: size and colour are design choices.

## Round 33 — TP-320 map credit theme

- Phone zh dark: Map tab, Ideas, Bookings, Calendar tabs and the trip page. The MapLibre credit kept the library's solid white box with black text and a black ⓘ, the only bright element on the dark map beside the dark map buttons.
- `map.css`: the credit uses `--glass-tint`, `--text-dim` and the `--glass-edge` hairline like the map buttons; links inherit the colour; the ⓘ icon is inverted in dark mode (both the system and the `data-theme="dark"` selectors). Light: `rgb(255,255,255)` → `rgba(255,255,255,.88)`; dark: white → `rgba(30,30,32,.88)` with `rgb(161,161,166)` text.
- Validation: phone Map tab crops in light and dark before and after. No machine check: the colour is a design choice for a third-party control.

## Round 34 — TP-321 calendar week range

- Problem: the trip Calendar week heading repeated the year on both ends. In Chinese ("2026年11月28日 – 2026年12月4日") it measured 308px in a 257px heading and was cut off with "…" in the desktop drawer.
- Fix: `TripHomeCalendar.tsx` formats the range itself and shows the year once when both ends share it ("2026年11月28日 – 12月4日", "28 Nov – 4 Dec 2026"); a week that crosses a year keeps both years. `Intl.DateTimeFormat.formatRange` was not used because zh gives numeric dates ("2026/11/28 – 2026/12/4").
- Evidence: zh heading 257/257 after the fix, before/after crops in zh dark and en light.
- Machine check: none. This is date copy for one heading; a test would pin the exact wording rather than a bug class, and Joey asked for few tests.

## Round 35 — TP-322 phone Mine heading alignment

- Problem: on the phone Mine tab the large "Trips" / "Chats" headings started at x=36 while the search field, segment control and cards started at x=28, and the "New trip" / "New chat" link text ended at 353 against a card edge of 362. Both kept the desktop sidebar's `padding-inline: var(--space-2)`.
- Fix: `phone/polish.css` drops the heading's inline padding and pulls the action out by the same `--space-2` with a negative end margin, so its padded hit area stays 44px tall and its text ends at the content edge.
- Evidence: headings x=28 and link text right=361 after, in en light and zh dark; before/after crops.
- Machine check: none. It is one alignment value on one screen; a style test would restate the CSS rather than catch a bug class.

## Round 36 — TP-323 trip card menu button

- Problem: the "⋮" button on trip cover cards was a 40% black rounded square (8px radius). On the phone Mine tab it is 44px, so it read as a heavy dark block on the cover gradient.
- Fix: `workspace/trips.css` makes it a pill-radius circle at 22% black with a 12px backdrop blur, like the app's other floating controls. Phone (44px) and desktop (28px) both change.
- Evidence: before/after crops on phone en light, phone zh dark and desktop en dark; computed radius 8px -> 999px, background 0.4 -> 0.22 alpha.
- Machine check: none. A visual weight choice for one control; no rule can tell a good fill from a heavy one.

## Round 37 — TP-324 Trips page calendar alignment

- Problem: the Trips page Calendar tab embeds the trip calendar, which kept its drawer padding (`var(--space-4) var(--space-5) var(--space-5)`). Its toolbar and grid ran 438-1250 inside a 414-1274 page column on desktop and 40-350 inside 28-362 on phone, out of line with the tabs, trip chip and View trip button.
- Fix: `workspace/trips.css` sets `.trips-calendar .trip-home-calendar { padding: 0 }`; the grid gap above already spaces it. The drawer calendar is unchanged.
- Evidence: toolbar and grid now 414-1274 (desktop en light, zh dark) and 28-362 (phone zh light); the phone week grid gains 24px and flight chips fit on one line. Before/after crops.
- Machine check: none. One container's padding in one context; a rule could not tell intended insets from stray ones.
- Also looked at: the Settings page card is full height with little content on "Your account"; left as the page-style settings design.

## Round 38 — TP-325 selected segment in dark mode

- Problem: in dark mode the calendar Week/Month control filled the selected segment with `--surface` (#1c1c1e) on a `--fill-hover` track, so "Week"/"周" was barely distinguishable. The shared `.segmented` thumb had a dark override to #636366; the calendar views, the top-bar views and the `.segmented` no-JS fallback each repeated `var(--surface)` without it.
- Cause: the selected-segment colour lived as a per-component dark override instead of a token.
- Fix: new `--segment-thumb` token in `tokens.css` (white in light, #636366 in dark), used by the `.segmented` thumb and fallback in `motion.css`, `.topbar-views` in `layout.css` and `.trip-home-calendar__views` in `trip-home-calendar.css`; the duplicated dark overrides in `motion.css` are gone. `docs/design/ui-guidelines.md` and `.zh.md` list the token.
- Evidence: calendar selected fill rgb(28,28,30) -> rgb(99,99,102) in phone zh dark and desktop en dark; light unchanged (white). Before/after crops.
- Machine check: `apps/web/tests/styles/selected-segment-fill.test.ts` scans every stylesheet for `[aria-pressed="true"]` / `[aria-selected="true"]` rules filled with `var(--surface)`. Red on the old code:
  ```
  AssertionError: expected [ …(3) ] to deeply equal []
  +   "motion.css: .segmented:not([data-segmented]) > [aria-selected=\"true\"], …",
  +   "workspace/layout.css: .topbar-views button[aria-pressed=\"true\"]",
  +   "workspace/trip-home-calendar.css: .trip-home-calendar__views button[aria-pressed=\"true\"]",
  ```
- Also looked at: Settings tabs (Edit profile, Personalisation, Language & region, Connected accounts); nothing worse found.

## Round 39 — TP-326 trip page chat list times

- Problem: the Chats list on a trip's page formatted `updatedAt` with `dateStyle: "medium"`, so a chat from yesterday read "2026年11月2日" / "2 Nov 2026", while the chat's own messages read "2 Nov 18:39".
- Fix: `TripHomeChats.tsx` uses the existing `formatMessageClock` from `lib/workspace/message-chrome.ts` (time today, day + month + time this year, year only for other years) instead of its own formatter.
- Evidence: "11月2日 18:39" (zh dark) and "2 Nov 18:39" (en light) after; before/after crops.
- Machine check: none. The fix removes a second formatter in favour of the shared one; a test would pin copy, not a bug class.
- Also looked at: phone Chat tab with the plan reply (fine apart from the dev-only Next.js badge over the Chat tab).

## Round 40 — TP-327 Chinese day labels

- Problem: `dayLabel` in `lib/trip/timeline.ts` formats `{ weekday, day, month }` in one `Intl.DateTimeFormat`; zh-CN returns "11月28日周六" with no separator, so chat day cards, itinerary day headings, the editor's day picker and the Bookings tab ran date and weekday together.
- Fix: for zh, format the date and the weekday separately and join them with a space ("11月28日 周六"); en keeps "Sat, 28 Nov".
- Evidence: chat day cards before/after in zh dark and en light; `tests/lib/trip` (53 tests) still pass.
- Machine check: none. A locale's joined output is a copy choice for one helper; a test would pin the string, not a bug class.

## Round 41 — TP-328 message action icon alignment

- Problem: message actions are 28px buttons around 16px icons, so the copy icon under an assistant reply started at x=274 against a text column at 268 (desktop) and 22 vs 16 (phone), and user-message actions stopped 6px short of the bubble edge.
- Fix: `chat/messages.css` gives `.msg-actions` `margin-inline: -6px`, pulling the row out by the icon's inset on both sides; the buttons keep their 28px hit area.
- Evidence: agent icon now 268-284 (desktop zh dark) and 16-32 (phone en light), matching the text edge; before/after crops.
- Machine check: none. Optical alignment of one row; no rule can tell an icon inset from an intended indent.

## Round 42 — TP-329 Chinese revision constraints in the Think trace

- Problem: in zh, the expanded Think trace showed "make the route geographically feasible" under "第 2 轮 · 正在修改受影响的部分。". Coordinator constraints are English instructions for the specialists, built from templates in `packages/orchestrator/src/planning/conflicts.ts`, and `ThinkingRows.tsx` printed them verbatim in three places (round heading, coordinator note, subagent constraints).
- Fix: new `apps/web/lib/chat/constraint-copy.ts` rewrites each known template (route, budget cut, arrival time, time clash, raise budget) in Chinese for zh readers, naming agents with the existing role labels; English and unknown text pass through. `ThinkingRows.tsx` uses it at all three sites. `docs/design/dsh-thinking-ui.md` and `.zh.md` note that a new constraint template needs a pattern there.
- Evidence: zh dark round heading now "让路线在地理上走得通"; en unchanged. Before/after crop.
- Machine check: `apps/web/tests/lib/chat/constraint-copy.test.ts` feeds one string per orchestrator template and fails if the zh output still holds an English word. Written before the module; red on the old code:
  ```
  FAIL  tests/lib/chat/constraint-copy.test.ts
  Error: Failed to resolve import "@/lib/chat/constraint-copy" from "tests/lib/chat/constraint-copy.test.ts". Does the file exist?
  ```
- Also looked at: account menu popover (fine).

## Round 43 — TP-330 assistant section names in the Think trace

- Problem: an expanded assistant row in the zh Think trace read "你要的是：为本次行程生成Day plan部分。" and "已生成itinerary部分。".
- Cause: `packages/orchestrator/src/planning/workflow.ts` passed `specialist.label` (the English role label) to `copy.objective` and the raw `proposal.agent` id to `copy.produced` / `copy.revised`, while `progress-copy.ts` took any string.
- Fix: `progressCopy` now takes an `AgentName` and names the section itself from `ROLE_NAMES` in the copy's language; the objective call passes `specialist.name`. `ROLE_NAMES.zh` now matches the app's labels (日程规划, 交通出行, 住宿, 目的地指南, 美食餐饮) instead of 每日行程 / 出行交通 / 餐饮; `docs/workspace-ui.zh.md` lists the same names.
- Evidence: a fresh local mock plan in zh dark shows "为本次行程生成「日程规划」部分。" / "已生成「日程规划」部分。"; before/after crop. Orchestrator tests: 435 passed.
- Machine check: the type. With the new `AgentName` parameter, the old call site fails `tsc`:
  ```
  src/planning/workflow.ts(207,26): error TS2345: Argument of type 'string' is not assignable to parameter of type '"itinerary" | "transport" | "accommodation" | "destination-guide" | "dining"'.
  ```
  and the copy can no longer print a raw id because it looks the name up itself.
- Not changed: revision reasons (`copy.fix` / `copy.revised`) still quote the English conflict reason; logged as an open idea.

## Round 44 — TP-331 Chinese flight and stay choice cards in the Think trace

- Problem: an expanded 住宿 row in the zh Think trace showed the choice card "Stay in 河内" with "Outer district · AUD 400.00 total · 3.8/5 · Free cancellation"; flight cards read "Flight 珀斯 → 巴厘岛", "Nonstop", "1 stop", "3h 35m".
- Cause: `choiceFor` in `packages/orchestrator/src/planning/supervisor.ts` built the card text with hard-coded English and never received the interface language. The delegated path's `outcomeFor` also printed "Produced accommodation section." with the raw agent id, bypassing the TP-330 copy.
- Fix: the card words (flight and stay titles, total, nonstop, stops, duration, cancellation terms) are now in `progress-copy.ts`, whose shared shape forces a Chinese version of each. `choiceFor` takes the interface language from `workflow.ts` and both supervisor sites; `outcomeFor` uses `copy.produced` / `copy.revised`.
- Evidence: a fresh local mock plan in zh dark shows 「大阪住宿」 and "Central · 共 AUD 900.00 · 4.3/5 · 可免费取消"; before/after crop. Orchestrator tests: 435 + 1 passed.
- Machine check: `packages/orchestrator/tests/supervisor.test.ts` "writes Chinese choice cards for a Chinese interface". Red on the old code:
  ```
  AssertionError: expected '[{"title":"Flight 珀斯 → 巴厘岛","selected…' not to match /Flight|Stay in|total|Nonstop|stop|Can…/
  ```
- Not changed: hotel areas from mock data ("Central", "Outer district") are data, not copy.

## Round 45 — TP-332 Chinese revision reasons in the Think trace

- Problem: a revised 日程规划 row in the zh Think trace read "修正：geography conflict on day 1: Mock attraction near 纽约 to Mock Corner Bistro, 纽约 needs 35 minutes including a 15-minute buffer but only 15 are available；…" and the same English inside "根据“…”修改了「日程规划」部分。".
- Cause: conflict reasons are English sentences written by `packages/orchestrator/src/planning/conflicts.ts` and the specialists (`packages/agents/src/itinerary/travel.ts`, `itinerary/index.ts`, `transport/index.ts`); the Chinese `copy.fix` / `copy.revised` quoted them unchanged. The delegated path's `outcomeFor` also appended the English constraints, which the row already lists (translated by TP-329).
- Fix: `progress-copy.ts` rewrites each "; "-separated part of a reason through Chinese patterns for every reason template (infeasible budget, over budget, arrival, time overlap, route timing, route provider failed or unavailable, overnight city, no grounded places); unknown text passes through. `outcomeFor` passes only the reason.
- Evidence: a fresh local mock plan in zh dark shows "修正：第 1 天从 … 到 … 需要 35 分钟（含 15 分钟缓冲），但只有 15 分钟；…"; before/after crop. Orchestrator tests: 437 passed.
- Machine check: `packages/orchestrator/tests/progress-copy.test.ts` feeds one example of every template and expects no Latin text besides the currency code. Red on the old code:
  ```
  AssertionError: expected '修正：infeasible budget: the cheapest fl…' not to match /[A-Za-z]/
  ```
  A new reason template is not caught by it; the open-ideas list notes that the reasons could become structured data instead.
- Not changed: place names from mock data stay English; a five-day route conflict still repeats the full reason in both the request and the result line (open idea).

## Round 46 — TP-333 sign-in page in the reader's language (suggestion 1 of 5)

- Context: Joey asked for all five design suggestions (2026-11-03 03:47 UTC); this is the first.
- Problem: the sign-in page was English for every reader: the intro, the three benefits, the loading and failure text, and the admin passcode form ("Admin passcode", "That passcode is not right.", "Enter with passcode").
- Cause: `apps/web/components/account/AuthScreen.tsx` and `PasscodeForm.tsx` held the text as JSX literals; the sign-in route sits outside the workspace's `LocaleProvider`.
- Fix: new copy tables `lib/i18n/messages/en-auth.ts` / `zh-auth.ts` (kept out of `MessageKey`, as the example prompts are) and `components/account/useAuthCopy.ts`, which picks the saved interface language or the browser language and sets `<html lang>`. Both components read from it; `PasscodeForm` is now a client component. The no-auth sign-in page drops its English `aria-label` on the form section.
- Evidence: local `/sign-in?passcode=wrong` in a zh-CN browser, desktop and phone: "管理员口令 / 口令不对。/ 用口令进入", `lang="zh-CN"`; before/after crop. `tsc` passes.
- Machine check: the type. `zhAuth` is `Record<keyof typeof enAuth, string>`, so every English line needs a Chinese one or `tsc` fails. No check can catch a new JSX literal written straight into the page; the repo has no lint rule for untranslated JSX text.
- Not changed: the Clerk card keeps Clerk's own English text; translating it needs `@clerk/localizations` and a locale known to the server-rendered `ClerkProvider`.
