# Agent Note: Trip data in Settings is the only data-mode control

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

The top-bar and phone Mine data-mode chip from
[request-scoped data mode](2026-09-21-request-scoped-data-mode.md) put a testing control in the main
workspace. Settings already had a Trip data row, so the same choice lived in two places that could
disagree: a stored chip choice overrode the Settings preference.

## Decision

Settings → Language & region → Trip data (site default, live prices, sample data) is the only
data-mode control, shown on every deployment. The workspace derives the mode from that preference,
falling back to `/api/data-mode` `configured` for "site default" and to mock when `liveAvailable` is
false; Live prices is not offered then. The chip, its `trip.dataMode` browser key and its tooltips are
removed. Requests still carry `x-trip-data-mode`, and the server still downgrades live to mock for a
caller who may not spend the allowance.

## Alternatives considered

**Hide the control on deployed builds** (PR #874, TP-226). Replaced at Joey's request on 2026-11-01:
the switch should stay reachable on the live site, just not in the main workspace.

**Keep the chip and the Settings row.** Rejected: two controls for one setting, with the chip winning.

## Consequences

- Supersedes only the top-bar `DataModeToggle` part of the 2026-09-21 decision; the request-scoped
  mode, `mockEnabled()` and `/api/data-mode` stand. No `packages/shared` change.
- A visitor who may spend the allowance can still choose live from Settings.
