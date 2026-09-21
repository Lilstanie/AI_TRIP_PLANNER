## Session summary

- Author: Claude Code, working with A (orchestrator/integration owner).
- Date: 2026-09-20 (Australia/Sydney).
- Module(s): `packages/tools/src/{maps,booking,google-places}.ts`,
  `packages/agents/src/accommodation/index.ts`, `packages/shared/src/{contracts,ports}.ts`.
- Goal / requirement source: A asked for restaurants and hotels to read real
  external data instead of the current mocks, with the output format
  guaranteed correct for agents to extract/process. Confirmed with A first
  (AskUserQuestion) that hotels should reuse Google Places rather than a new
  paid hotel-pricing API (Amadeus etc., which needs a personal account
  signup A would have to do, not me): real property name/rating/address,
  price as a clearly-labelled planning estimate — same convention already
  used for dining/destination-guide's unpriced real venues.
- What was done:
  - **Restaurants/attractions**: `MapsPort.places()`'s Google branch already
    existed (dining/destination-guide already call it) but had **zero**
    test coverage and was never actually exercised (`USE_MOCK_TOOLS=true` by
    default). Verified it against Google's real Places API (New) contract,
    then added 6 tests.
  - **Hotels**: `BookingPort.searchStays()` had no real-data path at all.
    Added one: real mode calls Google Places `searchText` for
    `"hotels in {city}"` and maps each result to a `StayCandidate`. Two
    correctness issues that needed explicit handling, not just a schema
    check:
    - **Rating scale.** Google's place rating is 1.0–5.0; every rating rule
      in this codebase (`StayCandidate.rating`'s `0-10` range,
      `accommodation.minRating`, `chooseInitial`'s `>= 8`) assumes 0-10.
      Passing Google's rating straight through would have silently
      misjudged every real hotel's quality while still passing Zod
      validation (4.6 is a "valid" 0-10 number) — added the `*2` conversion
      plus a test asserting it (4.6 → 9.2).
    - **Price.** Google has no live hotel-pricing API. Nightly price is
      estimated from Google's `price_level` bucket
      (`PRICE_LEVEL_INEXPENSIVE`/`MODERATE`/`EXPENSIVE`/`VERY_EXPENSIVE` →
      $90/$150/$260/$420), explicitly disclosed as an estimate, never a
      quote. `freeCancellation` defaults to `false` for real properties
      (Places doesn't report a cancellation policy, and guessing `true`
      would let a traveller who required free cancellation land on a hotel
      we can't back that up for).
  - Added `StayCandidate.grounded`/`StayOption.grounded` (optional,
    additive) so a real property can be told apart from a mock fixture
    through the existing single return-value channel, without agents
    reaching around the port to ask `@trip/tools` directly (that would break
    the ports-and-adapters boundary the ownership model relies on).
    `accommodation/index.ts` uses it to make `AgentProposal.source` truthful
    for whichever mode actually ran.
  - **Deduplication**: extracted `packages/tools/src/google-places.ts`
    (`searchGooglePlacesText`) and pointed `maps.ts`'s two Places call sites
    at it, removing one of the three near-identical copies of this request
    flagged in the 2026-09-20 Google Maps testing session log. (The
    `apps/web/lib/google.ts` copy is a separate package with a different
    response-shape need — Zod-validated `PlaceDetails` for the interactive
    workspace map — and wasn't merged into this; noted as a further
    follow-up, not done here.)
- Files changed: `packages/tools/src/google-places.ts` (new),
  `packages/tools/src/maps.ts`, `packages/tools/src/booking.ts`,
  `packages/agents/src/accommodation/index.ts`,
  `packages/shared/src/contracts.ts`, `packages/shared/src/ports.ts`,
  `packages/tools/src/{maps,booking}.test.ts`, `.env.example`, this log.
- Contract impact: yes, but additive/optional — `StayCandidate.grounded` and
  `StayOption.grounded` are both `?: boolean`, defaulting to absent for
  every existing caller. @team: no existing code needs to change, but if
  you build UI or logic that reads `StayCandidate`, know this field exists.
- Assumptions: no live call was made with a real API key (none configured
  here); verified against Google's public API docs and the existing
  `apps/web/lib/google.ts` code (already reviewed for validity in the prior
  session) for the request/response shapes. `MAPS_PROVIDER=osm` has no
  booking equivalent — `searchStays` throws `"Unsupported booking provider:
  osm"` in that combination (documented in `.env.example`); only `mock` and
  `google` are supported for hotels.
- External tools / mocks used: `fetch` stubbed via `vi.stubGlobal` for every
  new test; no real network calls or API key used.
- Open issues / TODO: flights (`searchFlights`) remain mock-only — no
  grounded flight provider was in scope for this request. The
  `apps/web/lib/google.ts` Places/Routes duplication against this package
  is unresolved (see above). Nobody has run the real-Google path against a
  live API key end-to-end.
- Reviewer: pending.
- Validation: 266/266 tests pass repo-wide (up from 250 before this
  session: 21 new in `maps.test.ts`/`booking.test.ts`); all 6 packages pass
  TypeScript checks; lint and the Next.js production build pass.
