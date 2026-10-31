# Map renderer lifecycle

`TripMap` disposes marker and route layers, observers, animation frames and pending callbacks before
disposing its renderer. Each renderer owns one full-height child of the map surface. A failed Google
constructor removes that child before fallback; a late SDK response cannot create a map after unmount.
Google authentication subscriptions preserve the existing host callback, snapshot listeners before
dispatch and restore the host callback when the last owner leaves. Their module-level set is a registry
of active map owners that becomes empty on disposal, not a cache of failed trips. Once Google rejects
the key, the SDK's `map.addListener` returns `undefined`; the renderer keeps no handle for it, so
disposing that map cannot throw. A rejected map has also lost its container, so setting `marker.map = null`
throws. `MapRuntime.removeMarker` is the one way to detach a marker: it removes the element when
Google has rejected the key, which lets the failure handler finish and the fallback mount.

Fallback belongs to the mounted map. A new mount follows the configured provider again; failed Trip
identities are not cached. Google reports a rejected key once per page, so `google-maps-sdk.ts` keeps
that one fact for the page, and each later renderer falls back at once. Strict Google mode keeps saved places and an explicit retry action instead
of silently switching providers. OSM disables satellite controls. The phone Trip home map has a fixed
340px height so its renderer can fill a definite containing block.

## Stop hover

`lib/trip/stop-hover.ts` holds the one hovered activity id. Itinerary rows and markers write it on
mouse pointers only, and `TripMap` repaints marker classes without a React render. A place visited
twice has one marker, which belongs to its first stop, so the later stop highlights no marker.

## Browser fixture

`trip-home-action-panels` runs the local Google SDK fixture (`google-renderer-fixture.mjs`) and proves one
renderer is kept when the action panel opens beside the map. It also rejects the key like Google does
with markers on the map, checks the map and its markers are gone without an error in the failure
handler, and leaves and reopens Trip home twice without a browser error. SDK and constructor failures have no
dedicated browser script. The fixture does not verify live Google services, production login, physical devices or
route duration accuracy.
