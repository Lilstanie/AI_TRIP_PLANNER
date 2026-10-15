---
date: 2026-10-15
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/packing-list-punctuation
pr: none
area: packages/agents, apps/web/tests
contract-impact: none
---

# Stop the Travel tips packing line from running items together (#349)

## What changed

- `packages/agents/src/destination-guide/index.ts`: packing items have trailing `.`, `!`, `;`
  and `,` stripped, empty items dropped, and the rest joined with `"; "`. With no items left, the
  `Pack:` clause is omitted.
- `packages/agents/tests/destination-guide/index.test.ts`: one new case asserting a single closing
  full stop and `; ` separators. Written and run red before the fix.
- `apps/web/tests/e2e/weather-provider-planning.e2e.mjs`: expected packing string updated to the
  `; ` separator.

## Why

The packing text was built with `join(", ")` and a fixed `.`. Model items that already end in
punctuation produced `., ` and `..`. Stripping only trailing `.`, `!`, `;` and `,` keeps `?`, so
questions in packing text keep their meaning.

## Validation

- `pnpm --filter @trip/agents exec vitest run tests/destination-guide/index.test.ts`, before the
  fix: 1 failed, 11 passed. Output showed `rain jacket., Walking shoes!, Sunscreen and a hat.`
- Same file after the fix: 12 passed.
- `npx vitest run` in `packages/agents`: 12 files, 126 tests passed.
- `pnpm turbo run typecheck --filter=...@trip/agents`: successful.
- `pnpm --filter @trip/agents lint`: clean.
- `npx prettier --check` on the three changed files: clean.
- `pnpm --filter @trip/web e2e weather-provider-planning`: completed, weather, provenance, plan
  and artifact all `ok`.

## Notes for the next person

- The output is still one paragraph in `TripTips.tsx`, not a bulleted list. #349 asked for a
  readable list, so this is a partial fix. A list needs a structured packing field in the agent
  contract (`packages/shared` is protected, so it needs approval).
- Internal `., ` inside an item is not stripped.
- The empty-list guard has no unit test. Per the repo rule, tests are not added after code.
