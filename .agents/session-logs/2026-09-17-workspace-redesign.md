# Workspace interface and interaction redesign

## Session summary

- Author: Claude Code (Opus 5)
- Date: 2026-09-17
- Modules: `apps/web/components`, `apps/web/lib`, `apps/web/app`, `packages/orchestrator/src/chat.ts`, `packages/shared/src/chat.ts`
- Goal: Audit and finish the planning workspace redesign. History / chat / map-only canvas on desktop, a right-hand Your Trip overlay drawer opened from a Trip pill, a left Trip Preferences overlay drawer, truly blank New chat sessions, independent local history, and preserved Google Places, routes, HITL, review, save/restore and geolocation behaviour. Mindtrip screenshots were used only as layout and interaction reference.
- Contract impact: `ChatRequest.mode` gains the optional value `"start"`; `BriefExtractor.extract` accepts `current: TripBrief | undefined`; `ConversationRecord` gains an optional `draft`. All changes are additive and backward compatible. The catalog stays version 3.

## Audit findings

1. The previous commit rendered `TripEditor` in map-only mode, leaving the timeline, day-route verification, activity move/time/place edits, preview and undo unreachable.
2. New chat hid the previous plan behind a `freshChat` flag. The Tokyo/demo plan stayed in memory, could flash on first paint after refresh, and a blank chat's preference form was not saved.
3. A blank chat sent by natural language had no brief, so the server filled missing fields from `DEMO_BRIEF` (Tokyo dates, group size and budget).
4. New chat aborted the active request without resetting `busy`, which could leave the chat input disabled.
5. Autosave is debounced by 350 ms. Clicking New chat or switching history inside that window discarded the outgoing conversation's latest changes (caught by a new test).
6. The workspace used `overflow: hidden`. In the browser a `scrollIntoView` shifted the whole grid 97 px left, pulling the off-screen drawer toward the viewport (caught during browser acceptance).
7. A single matched place made `fitBounds` zoom to maximum (blank tiles). One unmatched activity covered the map with a centred alert even when other markers were present. Google's map-type control was hidden under our control pill.

## What changed

- `Drawer.tsx`: shared overlay drawer with dialog semantics, `aria-hidden` / `inert` when closed, focus to the close button on open, Tab looping, Escape (yields to nested previews and open native dialogs), and focus return to the trigger. A flex header keeps the title and close button from overlapping.
- `Workspace.tsx`: rewritten around `plan: TripPlan | undefined`. `restoreWorkspace()` resolves storage before the first render, so a blank chat never requests the demo or flashes a previous trip. New chat, history switches and restores flush pending autosave, abort requests and clear progress, errors, selection and map routes. Drawers are mutually exclusive, and the Trip pill (with pending count) is the rightmost map action.
- `useTripPlaces.ts` + `TripMapCanvas.tsx`: one place-resolution hook shared by the map and the timeline. Lookups abort whenever the activity list changes, runtime matches stay in memory, partial failures show a compact notice, and the map resets to a world view for a chat without places.
- `TripEditor.tsx`: now a timeline-only editor inside the Your Trip drawer. It shares selection with map markers (selecting a marker jumps to its day) and publishes preview/verified routes to the map. Escape on the preview closes only the preview.
- `TripPanel.tsx`: drawer body with budget, Overview / Timeline & routes tabs (arrow-key navigation), stays and confirmations, and a sticky Review plan / Save trip footer.
- `ChatPanel.tsx`: optional plan and a blank-chat prompt. `FiltersPanel.tsx` takes its heading from the drawer. `WorkspaceSkeleton.tsx` mirrors the new shell.
- `TripMap.tsx`: `viewKey` refits on trip change, route-from-location requests abort and reset when the selection changes, a single place uses a fixed zoom, and the default map-type and Street View controls are disabled.
- `lib/workspace.ts` / `lib/workspace-catalog.ts`: `blankDraft`, `isDraft`, `itineraryActivities`, a conversation `draft` field, and `restoreWorkspace`.
- `packages/orchestrator/src/chat.ts`: `mode: "start"` extracts only from the message and throws `IncompleteBriefError` listing missing fields. The API route forwards that message. The local parser also recognises “visit X”.
- `globals.css`: new shell, drawer, map-canvas and tab styles. `overflow: clip`. The closed left drawer is translated past its own width, the sidebar and the shadow. 240 ms `cubic-bezier(0.32, 0.72, 0, 1)` with a reduced-motion override. Resize-handle styles removed.

## Automated verification

- `pnpm typecheck`: passed, 6 tasks.
- `pnpm lint`: passed, no ESLint warnings or errors.
- `pnpm test`: passed. 208 tests: web 63, orchestrator 43, agents 74, tools 28.
- `pnpm build`: passed; all application and API routes generated.
- New/updated web tests cover:
  - Trip drawer semantics, focus and closing by button, backdrop and Escape.
  - Drawer exclusivity and Preferences focus return.
  - The map canvas containing no timeline, editor or trip cards.
  - New chat clearing destination, dates, travellers, budget and chat input with no Sydney/demo content and no new trip record.
  - Blank-chat form/input autosave and restore after remount, including the flush before switching.
  - Natural-language `start` requests linking the generated trip.
  - New chat aborting an in-flight plan and ignoring its late answer.
  - A pending map place lookup not blocking chat, and its stale result being dropped after the chat plan replaces the trip.
  - Stale lookup isolation in `useTripPlaces`.
  - Catalog draft round-trip and restore.
- Orchestrator tests cover `start` rejecting missing fields without demo values and planning only from stated fields.

## Browser acceptance (local dev server, desktop 1600×900)

- Closed drawers: Preferences spans x −448…−48 and Your Trip spans x 1648…2640 in a 1600 px viewport. `documentElement.scrollWidth` = 1600; no horizontal scroll. Forcing `shell.scrollLeft = 500` leaves it at 0.
- Opening Your Trip: the drawer occupies x 608–1600 (992 px, 62% of the viewport) and covers the map and part of the chat. The map container stays at x 818–1600, 782 px wide, before, during and after. Title (x 629–709) and close button (x 1544–1580) do not overlap. Focus moves to Close your trip; Escape and the backdrop close it and return focus to the Trip pill.
- The Overview tab shows sections, stay choices, confirmations, Review plan and Save trip. Timeline & routes shows day selection, route mode, Verify day routes and activity editing. Review plan opens the review dialog over the drawer. Save trip added a saved copy (0 → 1) with a notice.
- Preferences opens from the sidebar edge (x 240–640) with focus on its close button. Opening it closes Your Trip; the backdrop closes it and returns focus.
- Map: live Google Maps rendered numbered markers with a linked place list. Clicking “1. To-ji Temple” set `aria-pressed`. Switching between the Tokyo and Lisbon chats refits the map to each trip.
- New chat: all preference inputs and the chat input are empty, focus is in the chat input, and no Tokyo/Kyoto/demo text appears in the chat, map or trip drawer. The map returns to a world view. The catalog shows a “New chat” record with no trip and no active trip. After reload, the blank chat and its unsent input were restored.
- Natural-language start: “I want to visit Lisbon” returned the missing-fields message (before the parser fix it also listed destination). “Lisbon, 2026-11-02 to 2026-11-06, 2 people, budget $2400” produced a real plan. The chat was renamed “Lisbon · 2026-11-02 – 2026-11-06” and linked to its new trip, three Lisbon markers appeared with one unmatched-activity notice, and the Trip pill showed 3 pending decisions.
- Narrow 375×812: History, Preferences, Chat, Map and Trip each show a single view with document width 375. The Trip view is interactive (not inert).

## Boundaries and remaining issues

- The Browser pane's key automation sends Enter/Escape with an empty `key`. Implicit form submission and native `<dialog>` Escape could not be exercised through it; Send was clicked instead, and Escape behaviour is covered by unit tests and a real Escape on drawers where the tool worked.
- The pane throttles rendering between screenshots, so drawer transitions finish only when a frame is drawn. Positions above were measured after a rendered frame.
- Geolocation permission was not requested in the browser; denied, timeout, unsupported and failure paths remain covered by `TripMap.test.tsx`. Precise location stays in `TripMap` component state only.
- Demo itinerary activities use placeholder text (“…at the grounded candidate place…”), so Google text search matches few of them and results vary between calls. This is a data-quality limitation, not a mapping failure.
- Without a GPT key the local regex parser handles `start` messages. It needs explicit YYYY-MM-DD dates and simple destination phrasing. The preference form remains the reliable path.
- The Tab focus loop uses layout visibility (`offsetParent`), which jsdom cannot evaluate; it was not covered by automated tests.
- Dark mode uses the existing tokens but was not visually re-checked in this session.
- No booking, payment, account, database or deployment changes.
