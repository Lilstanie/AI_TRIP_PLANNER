# Calendar stay bars failure inventory

Written before the week calendar drew a stay as one bar.

- A four-night stay repeats as four identical all-day cards, so the week header grows tall and the
  traveller has to read four cards to learn one fact.
- Two different hotels on consecutive nights merge into one bar.
- A stay that continues past the visible week is cut without saying how many nights it has.
- The bar is placed one column off (the hour gutter is the grid's first column).
- Timed stays (with a check-in time) disappear from the timed grid.
- The month view loses its stay entries.
- The bar text is English only, or overflows its columns on a narrow screen.

Evidence: `trip-home-calendar.e2e.mjs` writes `week-stay-bar.png` and the bar span it measured.
