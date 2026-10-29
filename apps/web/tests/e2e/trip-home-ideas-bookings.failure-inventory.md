# Trip home Ideas and Bookings failure inventory

The browser journey must fail when any of these outcomes regress:

1. Ideas omits an unscheduled activity or a restaurant suggestion.
2. A restaurant already present in the itinerary is shown as an idea again.
3. Choosing a day does not pass that idea and day through the established scheduling callback.
4. Scheduling leaves Trip home or opens a different Trip.
5. Bookings omits a booked activity, selected flight or selected stay.
6. A selected flight or stay is repeated because its selection also has a proposal item.
7. A candidate that was not selected appears as a booking.
8. Bookings follows itinerary order instead of keeping activity, flight and stay groups.
9. English or Chinese controls and group labels are unavailable.
10. Browser console or page errors occur during the journey.
11. The Ideas card count disagrees with the unscheduled activities plus restaurant suggestions in
    the Ideas drawer.
12. A converted flight or stay price is shown without the established currency-estimate notice.

The repeatable evidence is `trip-home-ideas-bookings.e2e.mjs`. It uses a local catalog fixture and
writes screenshots plus `summary.json` under `output/playwright/trip-home-ideas-bookings/`. It
proves browser behavior with fixture data, not live-provider or physical-device behavior.

Scheduling must retain visible refusal errors, persist an accepted day, and offer Undo that returns the item to Ideas.
