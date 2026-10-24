# English specialist summaries without (s): failure inventory

Written before the E2E (#604). After #601 fixed the Stay card, the transport, dining and
accommodation lines still printed "option(s)", "candidate(s)", "room(s)", "guest(s)", "leg(s)",
"day(s)" and "traveller(s)". Each line is a way the fix could fail.

- Any English specialist summary, assumption or progress line in the plan stream still has "(s)".
- The shared stay price detail still reads "room(s) × night(s)", or reads "1 rooms" / "1 nights".
- The Agent Lab fixture stays drift from the shared detail wording, or its stay-night check stops
  reading the night count.
- A count of one reads as plural ("1 transport options", "1 rooms") or a count above one as singular.
- The visible chat, Think disclosure or Trip panel still shows "(s)".
- The Chinese copy changes.
- The Stay card fixed in #601 regresses.
