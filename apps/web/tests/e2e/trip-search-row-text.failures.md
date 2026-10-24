# Trip search by row text: failure inventory

Written before the code (#641). Each line is a way the change could fail.

- Typing the trip title the row shows ("Trip to Sydney") finds no trip, because search reads the stored title.
- A numbered title ("Trip to Sydney · 2") cannot be picked out by its number, because "2" also
  matches "2030" or "AUD 640", or because the phone card renumbers the one trip left after filtering.
- The days text ("4 days", "4 天") or the amount ("AUD 1,090.00") on the row finds no trip.
- The date range the row shows ("14–17 Nov") finds no trip, while ISO dates still do.
- The Chinese interface searches English row text, or the English interface searches Chinese text.
- A query for one trip's title also returns a trip with a different destination.
- A trip found by its row text is missing from the phone Mine cards while the count says it was found.
- Stored-title, destination and ISO-date matches stop working.
- Chats search results change.

Run `DATA_MODE=mock pnpm --filter @trip/web e2e trip-search-row-text`. The browser catalog holds
two identical Sydney trips and one Melbourne trip, none renamed. The script reads each row's text
from the page at 1440×1000 and 390×844 in English and Chinese, types it back and checks the result.
