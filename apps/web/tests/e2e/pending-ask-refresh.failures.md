# Pending-question submission failure inventory

Scope: #422 and PR448 submission locking and cancellation, using intercepted chat responses.
Written before the production fixes; run with `pnpm --filter @trip/web e2e pending-ask-refresh`.

- A held answer lets radio, checkbox, custom text, pager, Enter, Submit or Skip change saved progress.
- A second answer appears accepted while the transport ignores it; the first reply discards that draft.
- Keeping the question visible removes the reachable, keyboard-operable Stop planning action.
- Stop dismisses the question, erases answers, or leaves controls locked instead of aborting the request.
- A response released after Stop updates the conversation or clears the retained question.
- Failure loses selections or custom text; reload fails to restore the same question and current step.
- Retry update sends a different answer or drops the existing plan, trip identity or known brief.
- Skip on the final question clears the card before acceptance or fails to send no preference.
- Failed skip cannot be retried; accepted skip reappears after reload.
- Success leaves a stale pending question in the catalog; conversations without one regress on reload.
- Malformed saved progress restores duplicate or multiple single-select answers.
- Optional debug callers break, English/Chinese Stop is inaccessible, or the phone card overflows.

Evidence must distinguish fixture-backed browser behavior from live models, providers and devices.
Use bounded held responses, save screenshots and raw request/assertion summaries, and retain red runs.
