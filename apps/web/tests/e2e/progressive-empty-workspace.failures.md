# Progressive empty workspace verification failures

Baseline: PR #713 at 67830a1badfd9638718c80812920095d2942ce40.

- Three existing TripFactChips workspace tests click hidden controls before input; update their user entry path while retaining request-payload, focus and rejected-plan assertions.
- The data-mode button loads asynchronously; an immediate count falsely reports its absence.
- A chat response containing only `reply` is invalid: the no-plan response must be `needs_info` with `question` and `known`.
- The plan fixture must implement TripPlan's brief, totals and sections contract.
- Reload retains conversation state; start a fresh chat before testing example-chip planning.
- A phone without a Plan must hide Trip, keep data mode in Mine and avoid horizontal overflow.
- Settings must remain the language entry point in both languages after shortcut removal.

Reproduce: `LABEL=baseline pnpm --filter @trip/web e2e progressive-empty-workspace`.
Baseline artifact: `output/playwright/progressive-empty-workspace/baseline/result.json`
(10 passed, 2 failed); Vitest baseline: 18 passed, 3 failed in TripFactChips.test.tsx.

- The existing ui-language journey also targets removed language shortcuts; retain browser-default, saved-language, reload, currency and phone coverage through Settings.

- The Plan response must be wrapped in a `complete` stream frame; a bare ChatResponse never produces a Plan in the streaming client.
- The Next development indicator overlaps the phone Chat tab (failure screenshot has no runtime errors). Hide the development-only portal for phone interaction, preserving page-error assertions; do not force-click a blocked application control.

- On phones the Brief container uses `display: contents` and its chip scroller is hidden; verify mounted progressive state plus the visible Trip details sheet instead of requiring a bounding box on that container.
