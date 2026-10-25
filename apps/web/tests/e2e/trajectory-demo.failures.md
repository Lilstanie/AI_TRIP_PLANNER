# Trajectory demo walkthrough failure inventory

The walkthrough is the Stage 2 demo record for the trajectory. A run must fail on any of these:

- Step 1: while the plan streams, the Specialist team button shows no working specialist, or the opened panel lists no working specialist.
- Step 2: a budget overrun after a mention produces no conflict check in the panel, or no revision assignment.
- Step 3: the finished reply's summary does not open the trajectory at its own turn, or the turn's traveller message is out of view.
- Step 4: the turn has no conflict-check record, pressing it opens no inspector, or the inspector omits the specialist's name or shows a token or duration field.
- Step 5: pressing a specialist's card opens no filtered trajectory, shows another specialist's records, or Show all records does not restore the ledger.
- Any step: a missing or unnumbered screenshot, a page error, or horizontal overflow at 390 px.
- The walkthrough passes in only one language or only one width.
- The result JSON omits a step, its screenshots or its checks.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.
