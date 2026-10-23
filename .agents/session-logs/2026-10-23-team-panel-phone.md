---
date: 2026-10-23
author: Claude
branch: feature/team-panel-632
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Specialist team button and sheet on the phone (#632, spec #629)

## What changed

- New `PhoneTeamButton`: an avatar-only button right of `PhoneTripTitle` that opens `TeamPanel` in the
  modal `FactPopover` sheet. `TeamAvatars` is now exported from `TeamControl` and shared.
- Layout `sheet` slot takes `"team"` beside `"facts"` (`open-team-sheet`, `close-team-sheet`), so the two
  sheets never open together and the sheet closes when the viewport leaves phone width.
- Styles in `phone-facts.css`; no new strings.
- `team-panel-phone` E2E with its failure inventory; `docs/workspace-ui.md`, `.zh.md` and the Agent Note.

## Why

Reusing the trip-facts sheet gives safe areas, focus trap, Escape and focus return without a second
implementation. The phone button had to override the shared 40px `.topbar-button` width.

## Validation

- `team-panel-phone` E2E against `next build` + `next start`: all checks pass at 390, 360 (en) and 390 (zh).
- `phone-shell` E2E: 250 of 251 pass; the failure is `phone-map: companion walk completed`, a map popup
  timeout in the sandbox, not checked against baseline.
- `tsc --noEmit`, `pnpm lint`, `check-ui-copy`, `verify:docs`, `verify:e2e-selectors` and
  `verify:e2e-artifacts`: pass.

## Notes for the next person

- The top bar has no keyboard-specific rule; the button hides with it because it lives inside it.
