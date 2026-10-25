# Neon account-memory driver failure inventory

- The production HTTP Drizzle adapter rejects interactive transactions before the callback runs.
- A repair replaces the JavaScript accommodation parser with SQL and changes legacy or invalid-input semantics.
- A write loses account scoping, a partial accommodation field, or the immediately preceding undo value.
- A rejected patch leaves the first-write placeholder behind instead of rolling back.
- A failed connection, statement or callback leaves its per-operation client open.
- A test swaps the database or Drizzle session for PGlite and therefore misses the production driver mismatch.
- A fake transport unexpectedly reaches Neon, or test-only Neon configuration leaks into later tests.

This probe keeps the installed Neon HTTP and WebSocket clients and Drizzle sessions. Its transport sends SQL and PostgreSQL wire frames only to in-process PGlite. It proves adapter compatibility and sequential transaction behaviour, not remote Neon transport or independent-session concurrency. Existing accommodation-memory checks own concurrent patch and undo-race coverage.
