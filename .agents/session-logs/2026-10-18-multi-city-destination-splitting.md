---
date: 2026-10-18
author: Claude Opus 5 (with Ziqi He)
branch: fix/multi-city-destination-splitting
pr: none
area: packages/orchestrator, apps/web/tests/e2e, docs
contract-impact: none
---

# "Sydney and Wollongong" is saved as two cities, not one oddly named one

## What changed

- `packages/orchestrator/src/destinations.ts` (new): `normaliseDestination` joins the cities a
  traveller named with ` & `, splitting on `&`, `、` and a standalone `and`.
- `packages/orchestrator/src/chat.ts`: the model path normalises `update.destination`, and the
  extraction schema now describes the ` & ` form so a configured model emits it directly.
- `packages/orchestrator/src/chat-offline.ts`: the offline extractor normalises the same way. It is
  applied where `patch.destination` is set, not inside `cleanDestination`, which also serves `origin`.
- `apps/web/tests/e2e/multicity-triage.e2e.mjs`: a second request writes the same trip with `and`
  and asserts two cities, the Sydney → Wollongong hop, and no flight.

## Why

`TripBrief.destination` is `&`-joined, and four readers already split on it (`cities` in
`@trip/agents`, the Agent Lab registry, `destinationCities`, and the Where editor), but nothing told
either extractor. Fixing the two producers leaves all four readers untouched; teaching each reader
about conjunctions would have spread the convention further.

The existing E2E sent `Sydney & Wollongong`, the form the code wanted, so it never exercised the way
a traveller writes it. That is why a bug this visible survived.

A place whose own name contains "and" (Trinidad and Tobago) is now split into two stops. The model
is asked for the joined form so the guess only applies to the offline path, and a wrong split is a
less bad outcome than today's single city with a phantom flight.

## Validation

- Reproduced against the local dev server before the change: `"destination":"Sydney and Wollongong"`,
  and transport planned a flight `Sydney → Sydney and Wollongong` with no price.
- After: `"destination":"Sydney & Wollongong"`, and transport reports
  `1 transport option(s) for Sydney ↔ Sydney → Wollongong · known estimate AUD 90.00`, matching the
  control case in issue #445.
- `BASE_URL=http://localhost:3001 node apps/web/tests/e2e/multicity-triage.e2e.mjs` — 12 API checks
  pass, including the four new ones. The browser half needs a Playwright download this machine lacks.
- `pnpm --filter @trip/orchestrator typecheck` — clean; `pnpm test` — 6 packages successful.
- `pnpm verify:docs`, `pnpm verify:pairs` — clean.

## Notes for the next person

- Issue #444 (a stated child counted as an adult) is the same shape and still open: `BriefUpdate` has
  no `party` field, so the coordinator can read `knownSoFar.party` but can never write it.
- Chinese `和` is deliberately not a separator: 和歌山 would split into nonsense. `、` covers the
  common enumeration.
