# Agent Note: One Trip data preference, default live, shared by the chip and Settings

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

The top-bar and phone Mine data-mode chip from
[request-scoped data mode](2026-09-21-request-scoped-data-mode.md) and the Settings Trip data row
were two stores for one choice: the chip wrote a `trip.dataMode` browser key that silently overrode
the Settings preference, and the browser started from the deployment's `configured` mode.

## Decision

Settings → Language & region → Trip data (live prices, sample data) holds the only data-mode
preference, on every deployment. The workspace chip (desktop top bar, phone Mine) reads and writes
that same preference, so the two always agree. It defaults to live prices (Joey, 2026-11-01); a stored
legacy "default" also means live, and `/api/data-mode` `configured` no longer steers the browser. The
workspace runs mock when `liveAvailable` is false: the chip is disabled with its sign-in hint and
Settings offers only sample data. Requests still carry `x-trip-data-mode`, and the server still
downgrades live to mock for a caller who may not spend the allowance.

## Alternatives considered

**Hide the control on deployed builds** (PR #874, TP-226). Replaced at Joey's request on 2026-11-01:
the switch must stay reachable on the live site.

**Settings only, no chip** (PR #883, TP-231). Reverted the same day at Joey's request: the chip is
the quick switch he wants in the workspace.

**Keep the separate `trip.dataMode` key for the chip.** Rejected: the chip won over Settings without
showing it.

## Consequences

- Refines only the chip part of the 2026-09-21 decision; the request-scoped mode, `mockEnabled()` and
  `/api/data-mode` stand. No `packages/shared` change.
- A signed-in visitor spends the shared allowance by default unless they switch to sample data.
