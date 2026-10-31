# Found restaurants reach the day plan: failure inventory

Written before the code (TP-195). A live Tokyo trip on 2026-10-30 had restaurants in the dining
section, yet the day plan said it had no dining candidates: the itinerary only ever asked for sights
and neighbourhoods. Each line is a way the change could fail.

- The itinerary still never asks for restaurants, so no day has a meal.
- A restaurant the tools did not return is accepted as a meal stop.
- Restaurants replace sights, or count toward how many sights a day gets.
- A restaurant failure removes the sights too, or is not reported.
- A meal stop overlaps a sight, a transfer, or falls before the flight lands.
- A meal from another city lands on a day spent elsewhere.
- The same restaurant is repeated every day while others are unused.
- A traveller's dietary requirement is ignored when picking the meal.
- The meal stop loses the restaurant's coordinates and place id, so the map cannot pin it.
- The meal reads as a sightseeing stop ("推荐游览点").
