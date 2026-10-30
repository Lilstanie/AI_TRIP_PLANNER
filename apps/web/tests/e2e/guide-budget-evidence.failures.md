# Destination guide budget evidence failure inventory

Written before the destination-guide evidence was changed (#524, TP-163). The "before" run uses `origin/main` source for `packages/agents/src/destination-guide/index.ts`.

| Failure mode                                                           | Evidence the E2E must capture                                                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| The guide model is handed the AUD budget as a bare number              | Record the `read_destination_evidence` tool result the stub model receives and require it to hold no `budgetTotal`.  |
| The guide model is handed the typed budget in its original currency    | Require the same tool result to hold no `budgetSource`.                                                              |
| Removing the budget also drops facts the guide uses                    | Require the tool result to still hold the brief's destination and dates, the travel month and the place candidates.  |
| The guide model is never called, so the check passes vacuously         | Require the stub to have answered at least one destination-specialist request and received its tool result.          |
| The plan stops completing when the stub refuses the specialist's reply | Require the `/api/chat` stream to end in a `complete` frame whose destination-guide section uses the local fallback. |
| The evidence is not repeatable                                         | Save the recorded tool result and `summary.json` in `output/e2e/guide-budget-evidence/`.                             |

The model is an OpenAI-compatible stub started by the script, so the run shows what the guide model is given, not what a real model writes.
