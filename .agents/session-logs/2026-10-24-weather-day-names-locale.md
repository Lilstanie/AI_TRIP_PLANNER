---
date: 2026-10-24
author: Claude (Joey's project thread)
branch: fix/weather-day-names-locale
pr: pending
area: packages/agents, packages/orchestrator, apps/web
contract-impact: none
---

# Weather tip day names follow the reply language

## What changed

- `packages/agents/src/summary-copy.ts`: new `weather(city, date, result?)` line in the English and
  Chinese copy. English is byte-for-byte what #644 shipped; Chinese reads
  `Tokyo，6月18日周五（预报）：…`, `（历史气候，非预报）` and `：暂无天气数据，出行前请查看最新预报。`.
  Day names use the same `Intl.DateTimeFormat` options as `dayLabel` in `apps/web/lib/trip/timeline.ts`.
- `weatherText` takes the reply language; the destination guide passes `ctx.replyLanguage`.
- Tests: failure inventory in `summary-copy.failures.md` first, then copy cases in
  `summary-copy.test.ts`, a Chinese run in `orchestrator/tests/weather-packing.e2e.test.ts`, and the
  web `weather-packing` E2E now shows the Chinese plan in the zh interface and checks the day text
  also appears in a day header.

## Validation

- `node scripts/redgreen.mjs weather-packing -- <three agents source files>`: before exit 1 (the
  Chinese guide read `Tokyo, Wed, 16 June: weather unavailable…`), after exit 0, 24/24 ok.
- `vitest` for `summary-copy`, `weather-packing` and `trip-weather-coverage`: all passed.

## Notes for the next person

- Packing items and the provider's weather summary are still English in a Chinese turn; only the
  wrapper text and day names are localised (#645 scope).
