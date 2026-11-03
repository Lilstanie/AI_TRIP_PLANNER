# Phone finish: failure inventory

Written before the batch 3 change (TP-353), from fixture-mode captures at 390x844 with the iOS app
user agent and Joey's simulator screenshots. Each line is a way the change could fail.

- The Agent Team sheet is still titled Trajectory, or its Chinese title is not 规划进度.
- Opening the sheet focuses the close button, so WebKit draws a ring around it.
- The Specialist team stays folded, or its six agents render as a two-column card grid with tags.
- A team row loses its status or its one-line objective, or the objective wraps.
- The area below the ledger is white while the rest of the sheet is grey.
- Pressing a team row no longer filters the ledger.
- The Trip tab shows more than one orange mark: unpriced, needs-a-place or not-found stays orange.
- The open-items row has no visible line, or tapping it no longer opens the list.
- The Trip home composer is still two rows tall and covers the bottom of the map card.
- The composer's add or send button falls below 44 px.
- In Chinese the badge line or the team title wraps.
- At 1440 px the open-items badge grows a label or the trip home composer changes.
