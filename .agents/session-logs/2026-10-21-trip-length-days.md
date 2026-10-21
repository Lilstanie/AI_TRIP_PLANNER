---
date: 2026-10-21
author: Claude
branch: fix/trip-length-days
pr: none
area: packages/orchestrator, docs
contract-impact: none
---

# Count a trip stated in days as that many days

## What changed

- `statedTripDays` in `chat-offline.ts` reads day counts ("3 days", "5-day", "四天", "三日游"), adding up each city's days.
- `update_trip_brief` sets the end date to start + days − 1 from that count, unless the message gives an explicit date range (#481).
- Coordinator prompt: endDate is the last trip day; never add a separate departure day.
- Updated the English and Chinese architecture docs.

## Validation

- Failure modes written first as tests in `chat.test.ts` (departure day added, hyphen and Chinese counts, multi-city sum, month and leap-day crossing, explicit range wins, "in 3 days" and one-day counts ignored, length change keeps the existing start); 4 failed before the change.
- `npx vitest run` in `packages/orchestrator`: 24 files, 290 tests passed.
- Orchestrator typecheck and lint passed.

## Notes for the next person

- Not checked against a real model in this sandbox (no model keys); the override does not depend on what the model sends.
