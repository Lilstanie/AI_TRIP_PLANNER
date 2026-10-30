# Map renderer lifecycle

`TripMap` disposes marker and route layers, observers, animation frames and pending callbacks before
disposing its renderer. Each renderer owns one full-height child of the map surface. A failed Google
constructor removes that child before fallback; a late SDK response cannot create a map after unmount.
Google authentication subscriptions preserve the existing host callback, snapshot listeners before
dispatch and restore the host callback when the last owner leaves. Their module-level set is a registry
of active map owners that becomes empty on disposal, not a cache of failed trips.

Fallback belongs to the mounted map. A new mount follows the configured provider again; failed Trip
identities are not cached. Strict Google mode keeps saved places and an explicit retry action instead
of silently switching providers. OSM disables satellite controls. The phone Trip home map has a fixed
340px height so its renderer can fill a definite containing block.

## Browser fixture

`trip-home-action-panels` runs the local Google SDK fixture (`google-renderer-fixture.mjs`) and proves one
renderer survives Expand and Collapse. SDK, constructor and authentication failures have no dedicated
browser script. The fixture does not verify live Google services, production login, physical devices or
route duration accuracy.
