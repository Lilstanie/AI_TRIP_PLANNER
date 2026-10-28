# Conversation and Trajectory with the Trip panel open: failure inventory (TP-133, #759)

`trajectory-with-trip-open.e2e.mjs` plans a mock trip at 1440x900, opens the Trip panel and presses the Conversation and Trajectory tabs. It then repeats the walk with the assistant running and at 390x844. It must fail when:

- Pressing Trajectory with the Trip panel open leaves the Trip panel on screen, or the Trajectory view is not shown.
- Pressing Conversation with the Trip panel open leaves the Trip panel on screen, or the conversation is not shown.
- The pressed tab reports `aria-selected` but the Trip button still reports `aria-expanded="true"`.
- The Trip button does not reopen the panel afterwards, or reopening it loses the view chosen underneath, so closing the panel again shows a different view.
- Choosing a specialist in the Agent Team panel while the Trip panel is open leaves the Trip panel on screen or does not show the Trajectory view.
- While the assistant is running, pressing Trajectory with the Trip panel open does nothing, or the running reply is lost.
- At phone width a Conversation or Trajectory tab appears, or the Trip view stops opening and closing from the bottom tabs.
- Page errors appear in the browser console, or `result.json` and the screenshots are not written.

The E2E runs in mock data mode with no keys. The first run is expected to fail before the fix.

Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e trajectory-with-trip-open --prod`. The script writes `result.json` and screenshots to `apps/web/output/playwright/trajectory-with-trip-open/<EVIDENCE_LABEL>/` (default `after`).
