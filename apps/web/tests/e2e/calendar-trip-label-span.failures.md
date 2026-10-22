# Calendar trip label across its week: failure inventory

Written before the E2E (#568). A multi-day trip bar is one button per day; only the first button of
each week row carries the label, which was clipped to that one day cell. Each line is a way the fix
could fail.

- The label is still cut at the first day cell, so "Sydney & Wollongong" reads "Sydney".
- The label runs past the trip's last day in that week row, over a neighbouring day or trip.
- A trip that crosses a week boundary labels the second row with the width of the whole trip.
- The following segments of the same bar paint over the label.
- A label that still does not fit loses its ellipsis.
- The phone calendar gains a horizontal page scroll.
- The compact duplicate-trip labels ("Syd·2") change shape.
