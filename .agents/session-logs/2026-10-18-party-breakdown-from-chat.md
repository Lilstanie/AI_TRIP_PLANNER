---
date: 2026-10-18
author: Claude Opus 5 (with Ziqi He)
branch: fix/party-breakdown-from-chat
pr: none
area: packages/orchestrator, apps/web/tests/e2e, docs
contract-impact: api
---

# Chat can now record who is travelling, not just how many

## What changed

- `packages/orchestrator/src/brief.ts`: `BriefPatchSchema` accepts `party`. `mergeBriefPatch`
  derives `groupSize` from a new breakdown, and drops a stale breakdown when a later patch gives a
  bare total.
- `packages/orchestrator/src/chat.ts`: `BriefUpdate` has a described `party` object, and `partyFrom`
  turns it into a `TravellerParty` with zeros for the kinds nobody is.
- `packages/orchestrator/src/chat-offline.ts`: `extractParty` reads "1 adult and 1 child",
  "两位大人和一个小孩" and the other four kinds. The written-number parser used by the existing
  group-size branch is now a shared `chineseNumber`.
- `apps/web/tests/e2e/party-breakdown.e2e.mjs` (new): seven API checks over both languages, a bare
  total, and a total that replaces a breakdown.

## Why

`TravellerParty` and the Who editor have existed for a while, and the coordinator prompt even told
the model that `knownSoFar.party` may be present, but `BriefUpdate` had no `party` field, so the
model could read a breakdown and never write one. "1 adult and 1 child" could only become
`groupSize: 2`, and `partyFor` in the workspace renders a party-less brief as all adults. The editor
fallback is right; the gap was upstream.

This is the fifth capability in this repository that existed with nothing to fill it
(`transport.origin`, `routeOptions`, `ModePreference`, `proposal.flights`).

## Validation

- Against the local dev server, the message from #444 now yields
  `groupSize: 2`, `party: {"adults":1,"children":1,"infants":0,"seniors":0,"pets":0}`. Before the
  change the same message produced no party at all and the coordinator asked for a traveller count.
- `BASE_URL=http://localhost:3001 node apps/web/tests/e2e/party-breakdown.e2e.mjs` — 7/7 checks.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` — 6 packages successful (275 orchestrator tests).
- `pnpm verify:docs`, `verify:pairs`, `verify:e2e-artifacts`, `verify:e2e-selectors` — clean.

## Notes for the next person

- Two chat tests caught a real mistake while this was written: assigning an `undefined` group size
  created an own property that overwrote the existing value through the object spread. Offline
  extraction must only assign a field it actually parsed.
- The offline Chinese extractor still cannot read a destination from "的悉尼行程"; the E2E uses
  "去悉尼" instead. That gap is unrelated to this change and is not fixed here.
- `groupSize` remains authoritative for cost. Specialists still ignore a party whose people do not
  add up to it.
