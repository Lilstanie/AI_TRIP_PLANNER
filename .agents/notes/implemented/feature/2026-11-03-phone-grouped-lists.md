# Agent Note: Phone grouped lists and the stop sheet

Status: implemented
Owner: module C, HeadmasterEggy

## Problem

On the iOS app and on phones the Trip tab stacked a large "Your trip" title under a top bar that
already named the trip, a sideways day strip that cut the third day in half, and stops drawn as a
card inside a card, with a white strip behind each stop's menu. A tapped stop opened its details
inside the itinerary, under the card it repeated. Mine showed each trip as a half-screen cover card,
so two trips already needed a scroll. Joey reviewed simulator screenshots on 2026-11-03, called the
app "still too ugly", and approved a three-batch redesign that starts with lists and details.

## Decision

All rules live in `apps/web/app/styles/phone/lists.css`, imported last by `phone/index.css` and
scoped to `.workspace-app[data-phone]`, so desktop and tablet are unchanged. This partly supersedes
the phone card styling in the [phone visual refresh note](2026-10-30-phone-visual-refresh.md):

- The Trip tab's day strip is a vertical grouped list with hairlines, one row per day; the selected
  day is tinted. Joey approved replacing the sideways strip on phones.
- A stop is one row: its button carries the card fill and its menu sits inside the row.
- A tapped stop's details open as a sheet with a grabber, fixed above the tab bar.
- The duplicate Trip heading is hidden visually and keeps its name for assistive technology.
- Mine lists trips as rows with a 48 px cover, the title, the dates and the total.
- The budget's status line is grey instead of orange; the unpriced count stays the one warning.

## Alternatives considered

- Keep the sideways strip and fade its edge: a third day stays cut off, and Joey asked for a list.
- Move stop details into a new component: the existing place card already holds the actions, so the
  sheet is a phone presentation of the same element.

## Consequences

`phone-polish.e2e.mjs` checks the vertical days, the stop sheet above the tab bar, the single-row
stop, the hidden-but-named heading and the compact trip rows; `phone-polish.failures.md` lists them.
Desktop keeps the strip and cards. Chat, the login page, the team panel and the map sheet height are
later batches.

## Sources

- Plan "iOS App 界面优化方案" (2026-11-03), approved by Joey; Jira TP-350.
