# Phone assistant chips in one row: failure inventory

Written before the code (#606). At 360 × 640 the six 44 px assistant chips wrap to three rows
(144 px), leaving the message list about 170 px. Each line is a way the fix could fail.

- On a phone the chips still take more than one row, or the message list barely grows.
- A chip drops below 44 px high, or its label is cut.
- A chip beyond the screen edge cannot be reached by swipe, scroll or Tab, or tapping it after
  scrolling does not insert its mention.
- Nothing shows that more chips are hidden past the edge, or the cue stays once the row is scrolled
  to its end.
- The row's scrolling moves the whole page sideways.
- The desktop row changes.
- The Chinese labels, which have different widths, still wrap.
