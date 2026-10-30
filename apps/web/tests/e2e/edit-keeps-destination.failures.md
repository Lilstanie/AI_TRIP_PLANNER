# Edit keeps destination failure inventory

Written before the model-free brief parser was changed (#804, TP-162). The "before" run uses `origin/main` source for `packages/orchestrator/src/chat-offline.ts`.

| Failure mode                                                           | Evidence the E2E must capture                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "Change it to 3 days" becomes the destination "Change it to"           | Read the second `/api/chat` completion and require `plan.brief.destination` to stay `Sydney`.                      |
| "Make it 3 days" becomes the destination "Make it"                     | Same check for a second wording that ends the leading words with a pronoun.                                        |
| The edit keeps the destination but does not shorten the trip           | Require `plan.brief.dates` to be `2026-11-12` to `2026-11-14` after the edit.                                      |
| The reply or stay names the edit words as a place                      | Require the visible reply text to contain no "Change it to" or "Make it" place phrase and to name Sydney.          |
| A first message that starts with a place and a day count stops parsing | Send `Tokyo 5 days from 2026-12-01 for 2 people, budget AUD 3000` in a fresh chat and require destination `Tokyo`. |
| A page error occurs during either run                                  | Collect page errors and fail with the observed messages.                                                           |
| The evidence is not repeatable                                         | Save screenshots and `summary.json` in `output/playwright/edit-keeps-destination/`.                                |

The run uses mock data with no model keys, which is the path signed-out visitors take on the deployed app. It does not establish model-backed behaviour.
