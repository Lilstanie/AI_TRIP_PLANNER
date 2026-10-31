# Chinese place names in the English interface: how it could fail

Written before the code for TP-197. With the English interface, `POST /api/places/search` sent `东京`
to Photon, which answered a place in Zhejiang (29.19, 118.98). Nominatim answers Tokyo
(35.68, 139.76), as it already does for the Chinese interface.

1. Han text in the English interface still goes to Photon: text containing Han characters must use
   Nominatim, whatever the interface language.
2. Latin text in the English interface stops using Photon: only Han text changes route.
3. Autocomplete starts calling Nominatim on every keystroke: autocomplete keeps its current route,
   because Nominatim's usage policy forbids it.
