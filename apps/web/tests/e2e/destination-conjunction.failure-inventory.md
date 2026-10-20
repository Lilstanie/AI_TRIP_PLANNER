# Destination conjunction failures

- A proper name containing `and` becomes two stops without confirmation.
- An offline multi-city request containing `and` is silently treated as one place.
- Confirming one place re-asks indefinitely or loses dates, budget and traveller count.
- Choosing explicitly separated cities fails to plan their transfer.
- An existing structured destination containing `and` gets rewritten.
- Chinese `、` is discarded before normalization.
- A clarification on an existing plan replaces that plan.

Exercise the public mock chat API and retain all NDJSON replies plus assertions.
