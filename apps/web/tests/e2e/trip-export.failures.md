# Trip export failure inventory

- Copy may omit scheduled stops, dates, times, notes or stays, include unscheduled ideas, or fail silently.
- Calendar events may have the wrong date, time, timezone, location, note or all-day end date.
- Calendar text may break on commas, semicolons, backslashes, newlines or long Unicode lines.
- Export may be inaccessible on phones or keyboards, or fail to report clipboard errors.
- Reopening or editing a trip may export an older plan.
- A day with no activities may be omitted from the copied plan, including its stay.
- An activity without an ID may collide with an ID equal to its array position in a calendar export.

Run `pnpm --filter @trip/web e2e trip-export` and inspect `output/e2e/trip-export/summary.json`.
