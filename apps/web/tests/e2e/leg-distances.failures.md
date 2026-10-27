# Leg distances: failure inventory

Written before the code (#745, spec #743). Each line is a way the feature could fail.

- A routed Leg shows no distance, or a distance in the wrong unit (metres under 1 km, kilometres with one decimal from 1 km).
- The Directions link has the wrong origin or destination, or the two are swapped.
- A stop without coordinates (never matched on the map) breaks the Leg: no link at all, or a link with `undefined` or `NaN` in it. The link falls back to the stop names and the distance is left out.
- The same place twice in a row produces a zero distance or a link from a place to itself. Neither is shown.
- A Leg with no route result invents a distance instead of leaving it out.
- The Show distances switch hides the Directions link as well as the distance, or leaves some distances visible.
- The switch is off after a reload when it was on, on after a reload when it was off, or is not on at first load.
- The preference cannot be read (storage throws): the page errors or starts with distances hidden instead of defaulting to on.
- The preference cannot be written (storage throws): the switch stops responding for the session.
- A stay with a known booking link shows no Book button, or a stay without one shows a dead Book button; a stop shows Book although no link is known.
- The Book button opens something other than the known link.
- Chinese labels for the switch, Directions, Book and the distance units are missing on desktop or on the phone.
- The Leg grows a second line of helper copy that repeats what the layout shows.
