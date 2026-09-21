---
date: 2026-09-21
author: DeepSeek Harness agent
branch: fix/ui-interaction
pr: none
area: apps/web
contract-impact: none
---

# Rebuild the chat composer as one card

## What changed

- `apps/web/components/chat/Composer.tsx` — new. One card holding the draft and its controls: a
  growing textarea, a control row with the calendar control and a state hint on the left, and Send
  or Stop on the right.
- `apps/web/app/styles/composer.css` — new, imported from `globals.css` after `todos.css`.
- `apps/web/components/chat/ChatPanel.tsx` — the `<form>` now wraps `<Composer>` instead of an
  `input` plus two buttons; the input ref is a `HTMLTextAreaElement`.
- `apps/web/app/styles/chat.css` — the old `.chat__form input` / `.chat__form button` /
  `.chat__calendar-trigger` / `.chat__stop` block is gone; the form is only the submit boundary.
- `apps/web/app/styles/forms.css` — `.composer__add` and `.composer__primary` join the exclusion
  list, so the global secondary-button rule does not dress them.
- `apps/web/tests/components/chat/Composer.test.tsx` — new, 5 tests.

## Why

The transcript above the composer had been rebuilt row for row against DeepSeek Harness while the
composer itself stayed a flat `input` with two text buttons, which was the last piece of the chat
surface still reading as a form rather than a composer. The port follows DSH's `InputBar` shape —
one capsule, attach-side control bottom-left, primary action bottom-right, the draft growing inside
the card — with this app's tokens and icon weight.

Three choices worth recording. Enter sends and Shift+Enter breaks the line, but a composition is
never a submit, or Chinese and Japanese could not be typed. Stop replaces Send in place rather than
appearing beside it, so stopping is never mistaken for sending. And the text surface is a
`textarea` rather than DSH's contenteditable: this app renders no chips or decorators inside the
draft, so the textarea gives the grow/keyboard/scroll behaviour without the editor.

## Validation

- `pnpm --filter @trip/web test` — 227 passed across 24 files.
- `pnpm --filter @trip/web typecheck` — clean. `pnpm --filter @trip/web lint` — no warnings or
  errors.
- Browser at 1280 and 420 px, light and dark: card 401 px wide and 98 px tall, 14 px radius,
  `--surface` background, 1 px `--border`; Send is the 34 px `--accent` circle, Stop the same circle
  in `--warn`; the textarea grew 36 → 46 px for a two-line draft and caps at 168 px; no console
  error and no overflowing element.
- Sent a real message in the browser and confirmed the composer's live states: field disabled, hint
  switched to "Planning…", Stop rendered, the todo dock reading `1 active · 2 pending`, and
  `role="status"` still the only new live region.

## Notes for the next person

- `forms.css` styles every button not on its exclusion list; a new composer control belongs on that
  list or it arrives with a border, a surface and a padding.
- The composer's card is one element with one focus ring. Adding a second interactive control means
  checking that the ring still reads as belonging to the whole card and not to the text.
