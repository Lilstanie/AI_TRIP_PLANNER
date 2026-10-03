---
date: 2026-10-03
author: Codex
branch: feature/deep-booking-provider-selection
pr: none
area: packages/tools, apps/web/tests/e2e, docs
contract-impact: none
---

# Deepen Booking provider selection behind ToolGateway

## What changed

- Added `packages/tools/src/booking-port.ts` to select fixture or live Booking adapters once per gateway.
- Kept `booking.ts` as the temporary direct-call compatibility surface and left `BookingPort` unchanged.
- Expanded the gateway provider matrix for Booking success, fallback, unavailable and failure behavior.
- Added `booking-provider-planning.e2e.mjs` with repeatable flight, stay, provenance, Plan and artifact evidence.
- Updated the tools README, architecture pair and the proposed provider-selection Agent Note for issue #130.

## Why

Booking policy, fallback and diagnostics now live behind the injected port instead of being reselected
inside each public adapter call. SerpApi-to-Google hotel fallback remains; flights remain SerpApi-only.

## Validation

- `pnpm --filter @trip/tools exec vitest run tests/provider-matrix.e2e.test.ts tests/booking.test.ts` — 41 passed.
- `pnpm --filter @trip/tools exec vitest run tests/provider-matrix.e2e.test.ts` — 12 passed.
- `pnpm turbo run typecheck --filter=@trip/tools` — passed.
- `node apps/web/tests/e2e/booking-provider-planning.e2e.mjs` — 6 checks passed; artifact saved and reread.
- `pnpm typecheck` and `pnpm lint` — passed.
- `pnpm test` — first run found one stale gateway diagnostic expectation; green rerun passed all 6 packages.
- `pnpm test:scripts` — 26 passed.
- `pnpm build` — passed; 20 static pages generated.
- `pnpm verify:docs`, `pnpm verify:protected` and `pnpm verify:pairs` — passed; 15 pairs checked.
- `pnpm exec prettier --check .agents/notes/proposed/architecture/2026-10-03-deep-provider-selection.md .agents/session-logs/2026-10-03-deep-booking-provider-selection.md apps/web/tests/e2e/booking-provider-planning.e2e.mjs docs/architecture.md docs/architecture.zh.md packages/tools/README.md packages/tools/src/booking-port.ts packages/tools/src/booking.ts packages/tools/src/gateway-internal.ts packages/tools/src/gateway.ts packages/tools/tests/gateway.test.ts packages/tools/tests/provider-matrix.e2e.test.ts` — passed.
- `git diff --check` — passed.

## Notes for the next person

- Issue #131 can remove the temporary raw adapter compatibility exports after a repository-wide check.
