# Phone Day stops sheet state: failure inventory

Written before the code (#607). The handle cycles collapsed → half → full, but half and full share
`aria-expanded="true"` and one name, so a screen reader hears no change. Each line is a way the fix
could fail.

- Half and full still expose the same accessible name and state.
- The announced step does not match the sheet's real height (`data-snap`).
- A keyboard path (ArrowUp, ArrowDown, Home, End, Escape) or a drag leaves the old step in the name.
- The name no longer contains the visible "Day stops" label (#421, WCAG 2.5.3).
- Collapsed stops reporting `aria-expanded="false"`, or half and full stop reporting `"true"`.
- The Chinese interface announces the step in English, or not at all.
