# Trip panel motion failure inventory

Covers `trip-panel-motion.e2e.mjs` at 1440x1000 and 390x844 with a saved fixture Trip. Fixture evidence only.

- Below the title the first element is not the budget summary line, or the selected day's plan does not follow it, on desktop or phone.
- Opening the budget summary does not show the breakdown, or closing it leaves the breakdown visible.
- The budget breakdown or the Travel tips open or close in one frame, so a frame sampled mid-motion shows neither the closed nor the open height.
- The budget breakdown and the Travel tips use different durations or easing functions.
- Content below an opening disclosure jumps: it moves before the motion starts, overshoots its final place or flickers.
- With `prefers-reduced-motion: reduce`, a disclosure animates instead of switching instantly.
- Screenshots (closed, mid-motion, open) and `results.json` are not saved at desktop and 390x844.

Run `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e trip-panel-motion`; add `--prod` when a dev overlay hides the UI. Output lands in `apps/web/output/playwright/trip-panel-motion/<LABEL>/` (`results.json` plus PNGs).
