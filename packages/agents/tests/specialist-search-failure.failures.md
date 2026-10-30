# Accommodation search failure

Written before the fix. Ways a failed provider search can go wrong inside the model loop:

1. The tool error returns to the model, which is forced to call a tool, so it searches again until
   the recursion limit of 25 stops it. A plan spends 13 provider searches on one failure.
2. The fallback after the failed loop searches the provider once more.
3. The failure is logged as a safe local plan although no plan exists.
4. The provider error is lost, so the workflow cannot report the real `agent_failed` reason.
5. A model that calls the search tool twice queries the provider twice.
6. A model failure after a successful search stops using the gathered evidence.

Transport is out of scope: `gatherTransportEvidence` already turns a failed flight search into empty
options, so its search tool does not fail on a provider error.

Repeat with `pnpm --filter @trip/agents exec vitest run tests/specialist-search-failure.test.ts`.
The fake model proves the loop ends; only a run with a real model proves the forced tool call.
