---
date: 2026-10-28
author: Claude
branch: feature/TP-138-quiet-walkthrough
pr: none
area: apps/web, docs
contract-impact: none
---

# Quiet itinerary panel walkthrough E2E and phone Ask AI fix

## What changed

- Added `apps/web/tests/e2e/quiet-walkthrough.e2e.mjs` and its failure inventory: one run over spec #755 at desktop, phone and Chinese.
- Fixed `sendFromTrip` in `WorkspaceView.tsx` so Ask AI leaves the Trip view on a phone.
- Documented the walkthrough in `docs/development.md` and `.zh.md`; added an Agent Note and a link from the itinerary-interaction note.

## Why

The walkthrough exposed that `ask-ai-menus` failed at 390px after the Trajectory switching change removed `selectView("chat")` from `sendFromTrip`.

## Validation

`pnpm --filter @trip/web e2e quiet-walkthrough --prod`, `ask-ai-menus` and `trajectory-with-trip-open` pass; `pnpm verify:protected|docs|pairs|e2e-selectors|e2e-artifacts`, `pnpm check:comments` and check-ui-copy pass; lint, typecheck and prettier results are in the delivery report.

## Notes for the next person

Ask AI after an edit asks `confirmReplacingEditedPlan`, so a script must accept the dialog.
