# Calendar and history search failure inventory

Run the browser journey against the unchanged integrated baseline before editing production code,
then rerun it after the fix. The fixture uses local saved trips and mock mode; it does not verify live
providers or authentication.

- A saved trip starting in a later month opens the When calendar on the current month pair, hiding
  its selected range.
- A trip starting on the first day of a month is shown only as trailing dates in the previous month.
- Clearing saved dates does not fall back to the current month, or reopening another trip retains a
  stale month from the prior trip.
- Trips with identical calendar identity retain indistinguishable visible labels or accessible
  names, including at compact phone width.
- A phone-width duplicate label contains its distinguishing suffix in the DOM but clips the painted
  glyphs or renders them too small to read at 390px or 375px.
- A compact phone label fits inside its calendar bar but overlaps the fixed phone tab bar, so its
  marker is partly obscured until the calendar panel scrolls.
- A disambiguated compact bar opens the wrong saved snapshot, or trips with distinct identities gain
  unnecessary duplicate suffixes.
- A multiword history query fails when terms appear in a different order or in different searchable
  fields, including terms split between a chat title and its messages, for either trips or chats.
- Multiword AND search returns a result when any term is absent, and single-word or empty searches
  regress.

The browser journey is `calendar-trip-identity-search.e2e.mjs`; run it with
`CHANNEL=chrome LABEL=baseline pnpm --filter @trip/web e2e calendar-trip-identity-search` before
production edits, then use a unique `LABEL` for each final integrated tree. Phone runs assert the
rendered glyph bounds fit inside each bar and above the fixed tab bar at 390px and 375px, after
scrolling the calendar panel enough to expose the final duplicate marker. It retains screenshots and
a JSON summary under `output/playwright/calendar-trip-identity-search/`.
