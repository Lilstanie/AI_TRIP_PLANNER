# Agent Note: Phone chat redesign

Status: implemented
Owner: module C, HeadmasterEggy

## Problem

A new phone chat left the top two-thirds of the screen empty while two rows of pills crowded the
composer, both cut off at the right edge. A planned reply ended in a sideways strip of Day cards that
also cut a card in half, plus an Open trip button. Small print about estimates sat under the composer
on every message, and long trip titles in the chat header were cut after a few words. Joey approved
batch 2 of the redesign on 2026-11-03.

## Decision

Phone only (`.workspace-app[data-phone]`, `apps/web/app/styles/phone/chat.css`, plus `ChatPanel` and
`MessageItem` branches that already took `phone` or `onOpenTrip`):

- A blank phone chat renders the example trips inside the message stream, three of them, as a grouped
  list centred in the open space. Desktop keeps its chips by the composer.
- The Where, When, Who and Budget chips share one row with an icon-only Preferences chip; the
  Preferences button keeps its accessible name.
- A planned reply on a phone drops the Day strip and its button reads "Itinerary · N days", built from
  the existing `itinerary` and `days` copy keys.
- The estimates footer is not rendered in the phone chat; Settings shows it below every section, on
  every device.
- The phone chat header title wraps onto two lines at 15 px instead of truncating.
- The thinking row was already one line that opens its details, so it is unchanged.

## Alternatives considered

- A new `viewDayItinerary` copy key: adding any key makes `tsc` fail with TS2590 at
  `components/trip/plan-revision.ts:209` ("union type that is too complex to represent"), so the label
  reuses two existing keys. That limit is a separate problem for whoever next adds a key.
- Keep the footer under the phone composer, as the
  [empty phone screens note](2026-10-27-phone-empty-states.md) chose: Joey's approved plan moves it to
  Settings to free the space; it still reaches every traveller there.
- Rename "Think" to a planning label on phones: it would need a phone flag in `ThinkingProcess`, and
  the row already met the one-line goal.

## Consequences

`phone-polish.e2e.mjs` checks the stacked examples, the uncut chip row, the absent footer, the single
itinerary button and the one-line thinking row; `phone-polish.failures.md` lists them. The next Next.js
"N" dev badge at the bottom left is the framework's development indicator and does not ship.

## Sources

- Plan "iOS App 界面优化方案" (2026-11-03), approved by Joey; Jira TP-352.
