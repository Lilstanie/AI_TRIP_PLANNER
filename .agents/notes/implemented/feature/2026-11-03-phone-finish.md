# Agent Note: Phone sign-in, planning progress, map sheet, trip home and warnings

Status: implemented
Owner: module C, HeadmasterEggy

## Problem

On the iOS app the sign-in page opened with a marketing block above three unlabelled icon buttons. The
Agent Team sheet was titled "Trajectory", hid the team behind a fold, focused its close button so
WebKit drew a blue ring around it on every open, and left a white half-screen below one turn. The Map
tab's Day stops sheet opened at half the map. On Trip home a 130 px composer covered the bottom of the
map card. The Trip tab put orange text on the budget card, on every day row and on stop tags, beside
an orange count badge. Joey approved batch 3 of the redesign on 2026-11-03.

## Decision

Phone only (`.workspace-app[data-phone]`, `html[data-shell="ios-app"]` or `max-width: 520px`, in
`apps/web/app/styles/phone/finish.css`), except the sign-in buttons:

- Sign-in keeps the brand and the headline; the eyebrow, description and benefits are hidden. Social
  buttons use Clerk's `appearance.options.socialButtonsVariant: "blockButton"`, so each names its
  provider, stacked one per row on phones. Clerk's "Development mode" footer is the Clerk development
  instance's and stays.
- The Agent Team sheet is titled "Planning progress" (规划进度), focuses its title instead of the close
  button, and opens the Specialist team as one list: icon, name, status and the latest objective on
  one line. Assignments and Decided markers stay on desktop. The sheet uses the page background.
- The Day stops sheet gains a one-third height and rests there; Home, ArrowUp, End and drag step
  through collapsed, one third, half and full. Stop rows are one card with hairline separators.
- The Trip home composer is one row: add, text, send.
- The open-items badge is a full-width row (count plus "To check") and the only orange mark on the
  Trip tab; unpriced, needs-a-place and not-found labels are grey.
- `KeyedNotice` (`lib/i18n/notice.ts`) folds every copy key without placeholders into one member.
  One member per key made any union that held a `Notice` too large: one more key failed `tsc` with
  TS2590 at `components/trip/plan-revision.ts:209`. With the fold, 40 extra placeholder keys still
  typecheck.

## Alternatives considered

- Reuse `planningDetail` for the title and keep three sheet heights, to avoid new keys: rejected once
  the TS2590 cause was fixed.
- A readonly tuple for the `useMemo` deps at the failing line: it moved the error to five other files
  after 20 more keys.
- Clamp the weather note to one line: it would cut "unavailable"; it is not orange and stays.
- Smaller map controls on the Map tab: the iOS Map tab is native Apple Maps with no controls, and the
  web controls keep 44 px targets.

## Consequences

`phone-map.e2e.mjs` checks the one-third rest and the four steps. `phone-finish.e2e.mjs` checks the
title, focus, team rows, badge row, grey labels and the one-row composer. The sign-in labels were
verified against the live page with this bundle option and stylesheet injected, because Clerk needs
its secret key to render locally. The [phone empty screens note](2026-10-27-phone-empty-states.md)
still names the sheet Trajectory; its copy is unchanged.

## Sources

- Plan "iOS App 界面优化方案" (2026-11-03), approved by Joey; Jira TP-353.
