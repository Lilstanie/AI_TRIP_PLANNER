# Geoapify sights survive a slow request: failure inventory

Written before the code (TP-179). A live OSM trip on 2026-10-30 got no day stops twice: sights ask
Geoapify twice (sights, then temples and shrines), the temple request often took 15–20 s, and its
15 s timeout threw away the sights that had already arrived. The itinerary then reported "no grounded
places available". Each line is a way the change could fail.

- One slow or failed request still discards the places the other request returned.
- Both requests fail, yet the caller gets an empty list and never tries Overpass.
- Several agents of one trip ask for the same city's sights at once and each waits 8–13 s for its
  own pair of requests.
- A failed or empty lookup is remembered, so later queries for that city never retry.
- A remembered result leaks into a query for another city or category.
