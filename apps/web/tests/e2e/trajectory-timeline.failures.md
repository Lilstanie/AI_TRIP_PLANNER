# Trajectory timeline, search and live tail failure inventory

Written before the code (TP-73, #669). Each line is a way the feature could fail; the browser journey must distinguish them.

- The overview has no lane for a record type that the turn contains, or draws a lane for one it does not.
- Clicking an overview block does not select its record, leaves the ledger scrolled elsewhere, or scrolls to a different record.
- Clicking a block for a record in an earlier turn leaves the pane at the tail.
- A duration, elapsed time, clock time or token figure appears in the overview, its tooltips or the ledger.
- The search box has no hit counter, so the traveller cannot tell how many records match.
- Searching a specialist name, a place or a flight number marks no record, marks a record that does not contain it, or marks different records than the overview marks.
- Matching records are not visibly highlighted, or the highlight stays after the query is cleared.
- Next and previous do not step through the hits in event order, do not wrap, or leave the current hit out of view.
- The current hit is not marked apart from the other hits, or two records are current at once.
- Enter in the search box does not step to the next hit, or Shift+Enter does not step back.
- An unmatched query shows a hit count above zero, or leaves the step buttons enabled.
- While a reply streams, the ledger does not scroll to the newest record, or shows it below the fold.
- After the traveller scrolls up, arriving records pull the ledger back to the tail.
- Returning to the tail does not resume following.
- Opening the Trajectory tab in the middle of a stream starts away from the tail.
- A running assignment is shown as finished, or the finished reply is missing once the stream ends.
- Search labels or the hit counter appear in the wrong interface language.
- The page overflows horizontally or logs a page error, or the overview is blank at 1440 px.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.
