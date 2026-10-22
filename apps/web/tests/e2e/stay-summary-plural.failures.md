# Stay card plural failure inventory

Written before the English stay summary was changed; the "before" run used `origin/main` source for `packages/agents/src/summary-copy.ts`.

| Failure mode                                    | Evidence the E2E must capture                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| The Stay card keeps the `room(s)` placeholder   | Read the Stay card text after the Sydney example and require `1 room, 3 nights in Sydney`. |
| The Stay card keeps any other `(s)` placeholder | Require the card text to contain no `(s)`.                                                 |
| A page error occurs during the planning run     | Collect page errors and fail with the observed messages.                                   |
| The screenshot or measurement is not repeatable | Save a screenshot and `summary.json` in `output/playwright/stay-summary-plural/`.          |

The run uses the mock data mode in a Chromium emulated viewport. It does not establish live provider or model behaviour.
