# Axe scan failure modes

Written from a run on `main` (2026-11-04) before the fixes in the same change. Each line is a way the
workspace has failed or could fail.

- A tab list wraps its tabs in `<li>` elements, so the tab role has no tablist parent (Settings).
- An element with `role="listitem"` is a sectioning element that the role is not allowed on.
- Dim text on a tinted surface (selected day card, calendar event times) drops below 4.5:1.
- A stay or flight label in the calendar uses opacity or a light tint and drops below 4.5:1.
- An accent-coloured text button on a dark fill drops below 4.5:1.
- A screen in the tour does not open, so its violations are never scanned.
