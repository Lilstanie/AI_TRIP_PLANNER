# Agent Note: Give each browser map runtime explicit lifecycle ownership

Status: implemented

## Problem

The browser map mounted directly into the Trip map host. A Google constructor failure could therefore
leave its error DOM in the host before MapLibre mounted, and renderer callbacks outlived their map.
The global `gm_authFailure` hook was also assigned once per component, so two mounted maps could
replace each other's callback. An SDK response completing after unmount could create an orphan map.

## Decision

`loadRenderer` creates one full-height renderer child and returns a `MapRuntime` that owns the map,
its event handles, one-shot callbacks, Google authentication subscription and disposal. A failed
constructor removes that child before fallback. Disposal removes tracked callbacks before destroying
the renderer and restoring the previous authentication hook when the final Google map leaves.

`TripMap` aborts a pending SDK load when its mount is disposed and disposes any result that completes
after that point. Authentication failure belongs to the mounted runtime: automatic fallback changes
the provider for that mount, while strict Google mode keeps saved places and an explicit retry action.
The phone Trip home map has a definite 340px height so the renderer cannot collapse under a percentage
height.

## Alternatives considered

- Clear the host after each constructor error: this hides the visible layer but still lets callbacks
  and a late SDK response outlive the component.
- Track one global authentication callback in `TripMap`: overlapping maps replace each other's callback
  and the final unmount cannot reliably restore the host hook.
- Cache Google failure by Trip identity: this makes provider availability depend on a previous visit
  rather than the current runtime and deployment configuration.

## Consequences

Every renderer must return event handles that can be removed and implement idempotent disposal.
Fallback is scoped to one mount, so same-origin navigation retries the configured provider. The
browser fixture proves constructor, authentication, script, delayed-load and breakpoint behavior;
live Google availability, production login and physical-device rendering remain separate evidence.

## Sources

- Issues #789 / TP-149 and parent spec #788; continuation PR #782.
- [Map renderer lifecycle](../../../../docs/map-renderer-lifecycle.md).
- [Failure inventory](../../../../apps/web/tests/e2e/map-renderer-lifecycle.failures.md).
