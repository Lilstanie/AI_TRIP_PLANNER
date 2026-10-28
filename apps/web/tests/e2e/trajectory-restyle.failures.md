# Trajectory restyle failure inventory (TP-137, #763)

Written before the code. `trajectory-restyle.e2e.mjs` plans a mock trip and walks the Trajectory view (empty, simple, full, inspector) at 1440x900 and 390x844 in English and Chinese, then repeats the stress states below. With `EVIDENCE_LABEL=before` it stores the screenshots of the old look; the default label `after` stores the new look. It must fail when:

- The empty Trajectory (no turn yet) shows no empty state, throws, or scrolls sideways.
- A very long turn (1500 characters with one unbroken 90 character token) pushes a simple row wider than the list, stretches the row past five lines, or scrolls the page sideways.
- A narrow container (800 px viewport, ledger beside the inspector) makes the toolbar, the timeline or the inspector overflow its panel.
- The toolbar, the view switch or the inspector is a flat opaque surface instead of the glass tokens (no backdrop blur) in the normal state.
- A row (simple row, ledger row) uses backdrop blur: glass belongs on floating surfaces only.
- Under `prefers-reduced-transparency: reduce` any glass surface keeps its blur or a translucent fill instead of the solid surface.
- Text on the toolbar, view switch, rows, result pills, round titles or inspector tabs falls below WCAG AA 4.5:1 in light or in dark.
- A control loses its visible focus ring, or a phone control drops below 44 px.
- The phone version overflows 390 px, in English or Chinese, in the simple list, the ledger or the inspector.
- Search stops counting hits, the simple and full switch stops switching, or opening a record stops opening the inspector.
- A Chinese label appears in English, or an English one in Chinese, in the Trajectory chrome.
- New helper copy appears: the visible strings of the view equal the strings before the restyle.
- Page errors appear in the console, or `result.json` and the screenshots are not written.

The E2E runs in mock data mode with no keys. Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e trajectory-restyle --prod`. The script writes `result.json` and screenshots to `apps/web/output/playwright/trajectory-restyle/<EVIDENCE_LABEL>/`. The glass and contrast checks are expected to fail on the first run, before the restyle.
