# Flight query local date failure inventory

Written before implementation. `parseFlightQuery` rolls a month-day without a year ("Feb 28", "11月4日")
to the next year when it falls before the traveller's today; today must be the traveller's calendar day,
not the UTC one.

- UTC is a day behind the traveller (Sydney 08:00 on 1 Mar is 21:00Z on 28 Feb): "Feb 28" is yesterday
  and must roll to next year, never depart in the past.
- UTC is a day ahead of the traveller (Los Angeles 19:00 on 4 Nov is 03:00Z on 5 Nov): "Nov 4" is today
  and must stay this year, not jump twelve months.
- Both hemispheres in both directions: Sydney and Tokyo (ahead of UTC), Los Angeles and São Paulo
  (behind UTC), in English and Chinese month-day forms.
- A local new year that UTC has not reached yet (Auckland 09:00 on 1 Jan 2027 is 2026-12-31Z): "Dec 31"
  is yesterday and must be 2027-12-31.
- A return leg without a year is still ordered after the departure computed in local time.
- Daylight saving changes the offset: the zone, not a fixed offset, decides the day.
- No `timeZone` on the request keeps the UTC behaviour, so older clients get what they always got.
- An unknown zone name is rejected by `ChatRequest` (the route answers 400) instead of silently falling
  back to UTC.
- Explicit years ("2026-11-02", "2 Nov 2026", "2027年3月2号") are unaffected by the zone.
- The route must hand the request's `timeZone` to `parseFlightQuery`; a fixed parser that the route
  calls without the zone still answers with the UTC day.

Evidence: `flight-query-local-date.test.ts` writes `output/flight-query-local-date.json` with each
instant, zone, message and parsed departure; the web route test replays the Sydney case over HTTP.
