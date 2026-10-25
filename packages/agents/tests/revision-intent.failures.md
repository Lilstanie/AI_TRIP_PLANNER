# Specialist revision intent: failure inventory

Written before production changes. The acceptance seam is each specialist's `invoke` method, using
fixed booking/map responses and disabled models; this is package integration evidence, not live-provider
or browser evidence.

- A typed budget revision with no English budget keyword keeps an expensive flight.
- A typed time, geography or infeasible revision mentions cost and accidentally selects cheaper fares.
- A typed time revision with neutral wording fails to move ground travel earlier.
- A typed budget, geography or infeasible revision mentions time and accidentally moves travel earlier.
- Transport, accommodation and dining disagree about a traveller's `request` keywords in the reason
  or constraints (`budget`, `cost`, `cheaper`, `overrun`, `cut`, `reduce`).
- A traveller's schedule request in the reason or constraints loses the early departure behavior.
- A mixed traveller request loses either the saving or scheduling intent.
- No revision or an unrelated request changes the normal fare, stay or meal allowance.
- Centralizing intent bypasses a supplied budget allocation or changes stay ranking within that share.
- A numeric target saving changes a typed non-budget revision into a budget revision.
- A successful model-backed transport or stay plan receives only prose and cannot distinguish typed
  budget, time and geography revisions. Check both normalized input and the authority rule before
  changing those model paths; a model-boundary stub is not live-model evidence.

Repeat with `pnpm --filter @trip/agents exec vitest run tests/revision-intent.integration.test.ts`.
The test writes observed proposals to `output/revision-intent/proposals.json` at the repository root.
