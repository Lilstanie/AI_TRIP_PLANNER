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
