---
date: 2026-10-29
author: Codex
branch: feature/TP-155-trip-action-panels
pr: 782
area: apps/web, docs
contract-impact: none
---

# TP-155 action panels stable map host final audit

## What changed

- Keep `homeMap` under TripHome aside; expanded drawer overlays or sits beside it.
- Extract `useWorkspaceTripEditor` so WorkspaceView stays under 1000 lines.
- Persist unsubmitted Trip preferences in the action drawer host.
- Strengthen `trip-home-action-panels` E2E around Google renderer identity across expand/collapse.

## Why

Parent audit required one stable map host/parent, not only `maps=1`. Fixture identity must track `.google-map__renderer`.

## Validation

- `pnpm --filter @trip/web typecheck` pass
- `pnpm --filter @trip/web lint` pass (existing ChatPanel/PhoneTrajectory hook warnings)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=fixture-only CHANNEL=chrome LABEL=tp155-renderer-identity-debug-10 pnpm --filter @trip/web e2e trip-home-action-panels --prod` pass; 49 assertions; artifact `output/playwright/trip-home-action-panels/tp155-renderer-identity-debug-10/`

## Notes for the next person

Exact-HEAD rerun required after this log commit. Fixture browser evidence only; not live Maps, production login, or physical devices. Calendar redesign remains #796.
