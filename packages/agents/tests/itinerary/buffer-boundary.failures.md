# Itinerary route buffer: failure inventory

- The model is instructed to leave a fixed 150-minute gap even when a shorter route is feasible.
- The prompt omits the 15-minute arrival buffer or presents unknown route times as verified.
- A gap shorter than the routed duration plus 15 minutes is accepted without a conflict.
- An unavailable route is treated as a zero-minute connection.
- A feasible short connection is rejected solely for being under 150 minutes.
