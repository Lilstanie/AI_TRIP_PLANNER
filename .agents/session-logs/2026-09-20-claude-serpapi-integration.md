## Session summary

- Author: Claude Code, working with A (orchestrator/integration owner).
- Date: 2026-09-20 (Australia/Sydney).
- Module(s): `packages/tools/src/{serpapi,booking}.ts`,
  `packages/shared/src/{contracts,ports}.ts`. Continuation of the same-day
  "real Google Places data" session (`2026-09-20-claude-real-places-data.md`)
  — same PR/branch (`feature/real-places-data`), since this replaces that
  session's estimated-hotel-price path with a real one where available.
- Goal / requirement source: A asked to integrate SerpApi's Google Hotels
  and Google Flights APIs for real-time prices, sharing one `SERPAPI_KEY`,
  one combined monthly quota (230 searches/month across both engines), one
  shared cache, and clear (non-crashing) error handling. Verified the exact
  parameters/response fields against serpapi.com's own docs pages first (via
  WebFetch), then verified the *error* shape empirically — neither doc page
  documents it — by making a real unauthenticated request with a garbage key:
  `{"error": "Invalid API key..."}` with HTTP 401.
- What was done:
  - New `packages/tools/src/serpapi.ts`: `searchHotelsSerpApi` and
    `searchFlightsSerpApi`, one shared monthly counter (module-level,
    resets on UTC month change) and one shared 15-minute result cache,
    both used by both engines. A typed `SerpApiError` with a `reason`
    (`not_configured` / `invalid_key` / `quota_exceeded` / `no_results` /
    `request_failed`) so callers can log or branch on why a search failed
    without string-matching messages.
  - Wired into `booking.ts` as the **first** real-mode tier: hotels try
    SerpApi first (if `SERPAPI_KEY` is set), and on *any* SerpApi failure
    fall back to the existing Google-Places-estimate path from the earlier
    session (real property, estimated price) rather than failing the whole
    search. Flights have no such fallback tier (there wasn't one before
    SerpApi either) — a SerpApi failure is thrown as a clear, typed error;
    `transport/index.ts` already `.catch()`es a thrown `searchFlights` and
    turns it into "flight remains unpriced" rather than crashing, so this
    doesn't regress anything.
  - Two correctness issues fixed, same pattern as the earlier Google Places
    session — a Zod range check would not have caught either:
    - **Rating scale**: SerpApi's `overall_rating` is Google's native
      1.0-5.0 scale; this project's convention is 0-10. Same `×2`
      conversion as the Google Places path, asserted with a test (4.6 →
      9.2), not just documented.
    - **Flight price scale**: SerpApi/Google Flights reports one price
      *per passenger* for the whole itinerary; this project's
      `FlightOption.priceUsd` convention (see `booking.ts`'s header
      comment, matching the existing mock fixtures) is a *whole-group*
      total. Missed, every group quote would be silently too low by a
      factor of `passengers` — caught by asserting it explicitly (2
      passengers × $450 → $900, not $450).
  - Extended `StayCandidate`/`StayOption` with optional `location`
    (`{latitude, longitude}`) and `detailsUrl`, and `FlightOption` with
    optional `stops` and `durationMin` — SerpApi is the first provider that
    actually reports these; Google Places/mock leave them absent rather
    than fabricated.
- Files changed: `packages/tools/src/serpapi.ts` (new),
  `packages/tools/src/serpapi.test.ts` (new), `packages/tools/src/booking.ts`,
  `packages/tools/src/booking.test.ts`, `packages/shared/src/contracts.ts`,
  `packages/shared/src/ports.ts`, `.env.example`, this log.
- Contract impact: yes, additive/optional only (`location`, `detailsUrl`,
  `stops`, `durationMin` — all `?:`). No existing caller needs to change.
  @team: flagged as usual since this is on top of the earlier session's
  already-flagged `grounded` field.
- Assumptions: **the shared quota counter and cache are in-process memory**,
  same reliability tier as everything else this codebase persists today —
  this genuinely caps usage at 230/month on a long-lived process (local
  dev, `next start`), but each Vercel serverless cold start resets the
  counter, so it is a soft guard in production, not a hard one, until a
  durable store exists. SerpApi's `departure_id`/`arrival_id` are
  documented as airport codes or a Google kgmid; this project's brief only
  carries free-text city names (e.g. "Sydney") — Google Flights has
  historically resolved common city names, but this is unverified against
  a real key for unusual routes. `freeCancellation` stays `false` for
  SerpApi hotels too, same reasoning as the Google Places path (not
  reliably exposed by either engine).
- External tools / mocks used: `fetch` stubbed via `vi.stubGlobal` for
  every new test — no real SerpApi credits spent. The error-shape check
  against the live endpoint used an intentionally invalid key (`api_key`
  parameter only; that call itself does not require a valid key or spend a
  credit, per SerpApi's own 401 response).
- Open issues / TODO: the in-process quota/cache limitation above should be
  revisited once/if a durable store exists.
- Reviewer: pending.
- Validation: 293/293 tests pass repo-wide (up from 266 after the earlier
  Google Places session today: 27 new — 21 in `serpapi.test.ts`, 6 in
  `booking.test.ts`'s new SerpApi describe blocks); all 6 packages pass
  TypeScript checks; lint and the Next.js production build pass.

## Addendum: real-key smoke test found and fixed a genuine bug

A ran this against their own real `SERPAPI_KEY` (never seen by me) locally
right after the PR went up. That surfaced exactly the risk flagged above as
untested:

- **Hotels worked as designed on the first try** — real properties
  (InterContinental Sydney, Sofitel Sydney Darling Harbour, Capella Sydney),
  real ratings correctly on the 0-10 scale, real GPS coordinates, real
  `serpapi_property_details_link` values.
- **Flights failed with free-text city names.** Calling with
  `{from: "Sydney", to: "Tokyo"}` — exactly the shape `transport/index.ts`
  actually sends, since `TripBrief` has no airport-code field — returned:
  `` `departure_id` ("Sydney") should either be an uppercase 3-letter code
  or start with "/m" or "/g" ``. So the doc-stated ambiguity ("airport code
  or Google kgmid") is not actually ambiguous in practice: SerpApi's Google
  Flights engine does **not** resolve city names the way the Google Flights
  website does, unlike the assumption this session started with. Every real
  flight search would have silently degraded to "flight remains unpriced"
  via `transport/index.ts`'s existing `.catch()` — never crashing, but also
  never actually returning a real flight, which defeats the point.

Fixed with a small `CITY_AIRPORT_CODES` lookup in `serpapi.ts` (covering the
cities this project's own demo fixtures already use — Sydney, Tokyo, Kyoto
→ Kansai, Paris) plus a new `SerpApiError` reason, `unsupported_location`,
for a city with no mapping — a clear, actionable message pointing at exactly
where to add one, instead of surfacing SerpApi's raw validation error. A raw
3-letter code or Google kgmid still passes through unchanged.

Re-verified against the real key after the fix: `{from: "Sydney", to:
"Tokyo"}` now returns real fares (China Eastern, Trinity Airways, Vietnam
Airlines; ~$3,300-3,750 round-trip **group** total for 2 passengers — the
per-passenger→group-total conversion holds up against real data too).

This is exactly why the "recommend a manual smoke test before relying on
this in a demo" line existed above — the assumption it was flagging turned
out to be wrong, and no amount of mocked unit testing would have caught it,
because the mocks were built from the same (incomplete) documentation as
the implementation. Added 3 more tests locking in the fix: a known city
resolves to its code, a raw code passes through unchanged, and an unmapped
city fails fast with `unsupported_location` before ever calling SerpApi.

Validation (updated): 293/293 tests pass repo-wide, as above. The real-key
calls themselves are not part of the automated suite (they'd spend real
SerpApi credits on every CI run) — this was a one-time manual check.

## Addendum 2: end-to-end through the actual web UI — two more findings

A asked to see the whole thing running through the real chat/HITL UI, not
just the tool layer. Two things surfaced that neither unit tests nor the
first real-key check (which called `serpapi.ts` directly) could have caught:

1. **`next dev` never loaded the root `.env.local` at all.** This repo's
   convention (`.env.example`, every prior session log) puts secrets in a
   single `.env.local` at the monorepo root. Next.js only loads `.env*`
   files from the directory it's actually run in — `apps/web`, per its own
   `dev`/`build`/`start` scripts — and does not walk up to a monorepo root.
   So `SERPAPI_KEY` (and, it turns out, every other var in that file —
   `MAPS_API_KEY`, `GPT_API_KEY`, etc.) was silently invisible to the actual
   Next.js server process the whole time, for anyone who followed this
   project's own documented setup and only ran `next dev` locally.
   `vercel env pull`/deployed functions are unaffected (Vercel injects env
   vars directly, independent of file layout), which is why this had never
   surfaced before. Worked around locally with
   `ln -s ../../.env.local apps/web/.env.local` (confirmed gitignored via
   the existing root `.env*` pattern, confirmed by `next dev` printing
   `- Environments: .env.local` on startup, which it did not before the
   symlink). **Flagging this as a real environment/DX gap the team should
   fix properly** (a documented symlink step for local setup, or a
   `next.config.js` change to point at the root file) — not fixed as part
   of this PR since it's unrelated to the SerpApi feature itself and
   affects every env var, not just this one.
2. **`packages/tools/src/gateway.ts` had a stale startup log**:
   `` `[tools] Live ${selected} Maps adapter enabled; booking remains
   fixture-backed.` `` — written before either the Google Places or SerpApi
   real-mode paths existed, so it was actively wrong once the env-loading
   issue above was fixed and a real run actually reached it. Fixed to
   report the real active booking tier (SerpApi / Google Places / fixture)
   instead of a hardcoded claim; added `gateway.test.ts` (this file had no
   tests before), since a diagnostic log going stale silently is exactly
   the kind of thing that should have a test pin it down.

With both fixed, a real plan for Sydney (2026-12-01 to 2026-12-04, 2
travellers, $3,000 budget) returned **20 real SerpApi hotel options** in
the actual "Choose your stay" HITL card — InterContinental Sydney, Sofitel
Sydney Darling Harbour, Capella Sydney, Park Hyatt Sydney, real budget
options (Pacific House Hostel, YHA Sydney Harbour), real prices, real
ratings correctly on the 0-10 scale (e.g. Capella Sydney 9.4/10).

One more small, real, not-yet-fixed observation from that same run: two
vacation-rental-style SerpApi results ("Cozy Queen Room in ...") had no
`overall_rating` at all and displayed as **"0/10"** — technically correct
per `normalizedRating`'s designed fallback (never crash, never fabricate a
rating), but "0/10" reads to a traveller as "worst possible" rather than
"no rating reported," which is misleading. Not fixed here (would need a
`rating?: number` semantics change so "no rating" can be rendered
differently from "rated zero," touching the shared contract and the
frontend card) — flagged for a follow-up, not silently patched over.

Separately (not a SerpApi issue, but worth recording since this was the
first live end-to-end run with `USE_MOCK_TOOLS=false`): the itinerary and
transport sections came back empty/conflicted
("geography conflict: no grounded places available", "driving estimate
cannot verify public transport timing") because no `MAPS_API_KEY` is
configured locally, so maps fell back to the free OSM/Nominatim provider,
which needs `OSM_USER_AGENT` set (the server logged exactly this warning)
and has its own real limitations for transit-timing verification. Unrelated
to hotels/flights; out of scope for this PR.

Validation (updated again): 298/298 tests pass repo-wide (5 new in
`gateway.test.ts`); typecheck/lint/build clean.
