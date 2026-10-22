---
date: 2026-10-21
author: Claude Opus 5 (with Ziqi He)
branch: docs/demo-runbook
pr: none
area: docs
contract-impact: none
---

# Demo runbook, written from a measured clean build

## What changed

- `docs/demo-runbook.md` and its Chinese pair: toolchain versions, the three build commands, the
  environment variables a demonstration needs by name only, how to fall back to mock data, and a
  symptom table for the day.
- `docs/README.md` and `docs/README.zh.md` link the new page.

## Why

Every number on the page was measured, not recalled. A clean `--depth 1` clone of `main` into an
empty directory was installed, built and started with no environment variables at all, then driven
through `/api/data-mode`, `/api/places/search` and a full `/api/chat` plan.

## Validation

Clean build, Node 24.14.1 / pnpm 9.15.0, no environment variables set:

- `pnpm install` 3.8 s with a warm pnpm store; the tree is 829 MB of `node_modules` plus 481 MB of
  `.next`.
- `pnpm build` 29 s, exit 0, no warnings in the log.
- `pnpm --filter @trip/web start` ready in 206 ms. `/` 200, `/agent-lab` 200, `/sign-in` 307.
- `/api/places/search` in mock returned the Kyoto fixture.
- `/api/chat` completed a five-agent plan: 5 sections, estimate 2770 against a 4000 budget, no
  conflicts. `transport` and `accommodation` reported `mock`; `itinerary`, `dining` and
  `destination-guide` reported `fallback`.
- `pnpm verify:docs` and `pnpm verify:pairs` clean (28 pairs).

## Notes for the next person

- `fallback` on those three sections comes from `usedFallback = !generator` in the itinerary, dining
  and destination-guide agents: without `DEEPSEEK_API_KEY` there is no generator. Mock data replaces
  the providers, not the model, so a demonstration still wants that one key.
- `maps: true` from `/api/data-mode` is `Boolean(MAPS_API_KEY) || mapProviderSetting() !== "google"`,
  so it is true with no key whenever the OpenStreetMap fallback is available. The runbook says so;
  the field itself is still easy to misread.
- The install timing is only honest for a warm pnpm store. Nobody should first install at the venue.
