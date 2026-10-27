# Glass tokens failure inventory

Covers `glass-calibration.e2e.mjs` and `liquid-glass.e2e.mjs` at 1440x1000 and 390x844, light and dark.

- A floating surface (top bar, sidebar, team popover, a sheet, the phone tab bar, a surface carrying `glass-float`) has no backdrop blur, or its blur, saturation, border or shadow differs from the shared tokens.
- A floating surface paints its own fill instead of `--glass-tint`; the team popover keeps a hard-coded `--surface` fill and no blur.
- The phone tab bar or the Day stops sheet declares its own glass values instead of the shared tokens.
- The phone top bar is not glass.
- A content card (empty chat card, stop card, trip card caption, calendar grid) or a chat bubble has a translucent fill or a backdrop blur.
- Body text or secondary text on a glass surface falls below 4.5:1 against the page backdrop or a mid-tone map backdrop, in light or dark mode.
- With `prefers-reduced-transparency: reduce`, any floating surface keeps a blur or a translucent fill; the team popover, the phone tab bar and the Day stops sheet are the likely misses.
- A surface that opens only on demand (team popover, fact sheet) is skipped by the fallback check because it was not open when the check ran.
- The later open-items popover cannot reuse the material because no class or variable contract exists.
- Screenshots or `results.json` are not saved at desktop and 390x844.

Run `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e glass-calibration` and `... e2e liquid-glass`; add `--prod` when a dev overlay hides the UI. Output lands in `apps/web/output/playwright/glass-calibration/<LABEL>/` (`results.json` plus PNGs).
