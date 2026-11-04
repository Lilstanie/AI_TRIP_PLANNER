# iOS app shell failure modes

- A route service snaps a leg to the nearest road, so the drawn line stops short of its pin.
- A details panel taller than half the native map box is clamped, so the selected stop sits below
  the centre of the visible area.
- The native map keeps the inset from a shorter panel after the panel grows.
- A tab label's text changes (language switch) without a node or attribute change, so the native tab
  bar keeps the old label.
- The native map's visible area is measured on the first frame of the day sheet's height transition
  and never again, so taps on the sheet's new area reach the map.
