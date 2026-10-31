# Agent Note: Phone visual refresh and the new-chat fact row

Status: implemented
Owner: module C, HeadmasterEggy

## Problem

At 390 px the phone shell still looked like the desktop squeezed down: a flat tab bar welded to the
screen edge, bordered boxes for every budget line, day and stop, separate cards for each Mine chat and
each Trip home action, Settings as a small centred card with side margins, and a new chat that was a
blank screen above the composer. Brief facts on a new phone chat were reachable only through the
Trip details button in the top bar, which the [empty phone screens note](2026-10-27-phone-empty-states.md)
left hidden until the traveller started.

## Decision

- Joey chose (2026-10-30) a sideways row of Where, When, Who, Budget and Preferences chips above the
  composer on a phone chat with no messages and no Plan. It is the same `TripFactChips` instance the
  top bar uses, moved into `ChatPanel` through its `facts` prop, so the editors, validation and the
  Trip details sheet stay one implementation. It sits outside the chat form so the editor's own form
  submits on its own. Once the chat has a message or a Plan, the chips return to the top bar exactly
  as before.
- No greeting heading is added: the composer prompt already asks where to go, and the empty-screen
  rule allows the question once.
- All visual changes live in `apps/web/app/styles/phone-polish.css`, imported last by `phone.css` and
  scoped to `.workspace-app[data-phone]`, so desktop and tablet stay unchanged:
  - the tab bar is a floating glass capsule with a filled pill under the selected tab;
  - budget, day strip, stops, travel tips and reply day cards become soft shadowed cards without
    borders; Open trip is a filled accent button; the Trip tab title is a large title;
  - Mine's chats and the Trip home actions and chats are grouped lists with hairline dividers;
  - Settings opens as a bottom sheet with a grabber;
  - the Trajectory sheet gets a large title and a grouped Specialist team row.

## Alternatives considered

- Keep facts only in the Trip details sheet: Joey preferred them visible beside the composer, as
  Mindtrip does.
- Render a second `TripFactChips` in the chat: two instances would both own the open editor.
- Restyle the shared desktop rules: the desktop polish loop is changing those files; a phone-only
  stylesheet avoids collisions.

## Consequences

The `phone-empty-chat-hint` check now expects the chip row above the composer on phones and keeps the
hidden Brief bar on a blank desktop chat. `phone-polish.e2e.mjs` (with `phone-polish.failures.md`)
covers the chip row and its editor, the tab bar, grouped lists, the Settings sheet, dark theme,
Chinese at 360 px and an unchanged desktop, and saves screenshots and `summary.json`.

Follow-up TP-199 (2026-10-31, from Joey's iPhone): a glass rule gave every top-bar child
`position: relative`, which pulled the Trip details sheet into the top bar; it now skips the fact
sheet, its scrim and the trajectory dialog. Brief sheets end at `62px + --phone-tabbar-gap` so the
floating tab bar no longer covers their last row; Mine section titles do not shrink; the document
and the chat stream contain overscroll so a swipe never drags the page.

## Sources

- Thread "大幅美化手机端界面" (2026-10-30); [phone shell note](2026-10-05-phone-shell.md).
