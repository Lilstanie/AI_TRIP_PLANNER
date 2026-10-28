# Leg distances: failure inventory

Written before the code (#745, spec #743). Each line is a way the feature could fail.

- A routed Leg shows no distance, or a distance in the wrong unit (metres under 1 km, kilometres with one decimal from 1 km).
- The Directions link has the wrong origin or destination, or the two are swapped.
- A stop without coordinates (never matched on the map) breaks the Leg: no link at all, or a link with `undefined` or `NaN` in it. The link falls back to the stop names and the distance is left out.
- The same place twice in a row produces a zero distance or a link from a place to itself. Neither is shown.
- A Leg with no route result invents a distance instead of leaving it out.
- A Show distances switch, or its Chinese label, still renders.
- A browser that stored the old preference as off still hides distances or the Directions link after a reload.
- Any code reads or writes the old `trip.show-distances.v1` preference.
- A stay with a known booking link shows no Book button, or a stay without one shows a dead Book button; a stop shows Book although no link is known.
- The Book button opens something other than the known link.
- Chinese labels for Directions, Book and the distance units are missing on desktop or on the phone.
- The Leg grows a second line of helper copy that repeats what the layout shows.
