# Empty chat on a short phone: failure inventory

Written before the code (#536). At 360 × 640 the "Where to next?" card scrolls inside a 314 px
stream, hiding the fourth example and "Add trip details" without a cue. Each line is a way the fix
could fail.

- The fourth example or "Add trip details" starts below the stream's visible bottom with no cue that
  the card continues (the phone composer and six assistant chips leave the stream 171 px at 360 × 640
  in English, so every target cannot fit).
- The fade stays after scrolling to the end, or shows when nothing is hidden.
- An example or "Add trip details" drops below 44 px high to make room.
- An example label is cut so the trip it plans cannot be read.
- The Chinese card, with different label lengths, still overflows.
- Taller phones (390 × 844) or desktop lose the explanatory paragraph they have room for.
- The page gains a horizontal scroll.
