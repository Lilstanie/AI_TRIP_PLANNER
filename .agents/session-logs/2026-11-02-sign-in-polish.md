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
