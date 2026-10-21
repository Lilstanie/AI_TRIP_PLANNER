# Issue 462 failure inventory (before production edits)

- Trip bar exposes raw ISO rather than the full date already announced by its grid cells.
- English and Simplified Chinese weekday, month, day, year or translated range separator is wrong.
- Same-day trips lose either endpoint; multi-day or year-crossing ranges lose the end year.
- UTC date-only strings shift a day in Honolulu or Sydney, including the weekday.
- Locale changes leave stale accessible names.
- Tab/arrow focus becomes invisible or Enter/Space opens a different trip.
- Calendar bars or long accessible names cause horizontal page overflow at 1440, 390 or 375 px.
- Formatting widens invalid-date acceptance: TripBrief and parseSnapshot must retain their existing validation; no new parsing/fallback policy.

Browser journey: seeded local/mock trips, literal expected names, DOM/ARIA snapshots and screenshots;
1440x1000 (Honolulu), 390x844 (Sydney), 375x844 (Honolulu), both UI languages.
Run before and after using RUN_ID to preserve the failing and passing evidence separately.

Baseline discovery: same-day trips are rejected by the existing minimum-one-night contract. E2E preserves same-day and invalid-date rejection rather than widening the calendar input contract.
