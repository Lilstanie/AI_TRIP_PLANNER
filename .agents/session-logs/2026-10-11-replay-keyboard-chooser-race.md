---
date: 2026-10-11
author: Codex
branch: feature/e2e-performance-acceptance
pr: 308
area: apps/web/tests/e2e, docs
contract-impact: none
---

# Fix the Replay keyboard file-chooser interception race

## What changed

- Keep Enter activation through the Replay button locator after registering filechooser.
- Add 16x CPU stress to the existing keyboard E2E boundary, restoring speed and detaching CDP in finally.
- Update paired known-failure docs and the existing performance acceptance decision.

## Diagnosis

Normal narrowed trigger passed 10/10. The same trigger under 16x CPU throttle failed 10/10, including two 30-second waits; a fresh-page minimal trigger failed 3/3. DOM probes showed trusted Enter/click, active user activation and an enabled input. Protocol evidence showed keydown/keyup completing before Page.setInterceptFileChooserDialog was acknowledged. Changing only to locator.press passed 10/10.

## Validation

- Regression added before the fix: public CLI Replay run failed at the same 30-second filechooser wait (2026-10-11T06-11-35-913Z-73270-la5bly).
- After the locator fix: public CLI Replay passed all 71 checks (2026-10-11T06-13-08-408Z-73648-mtka08).
- Collection acceptance passed default smoke, replay, multiple named journeys and all supported journeys; all-supported evidence: 2026-10-11T06-18-18-470Z-75899-4p7io1.
- pnpm verify:docs and verify:e2e-selectors passed; an exported staged tree passed documentation links and all 26 translation pairs.
- No application code, shared contract, CI configuration or new explanatory code comments changed.

## Notes for the next person

- Diagnosis/protocol and failed attempts are retained in output/e2e/replay-keyboard-debug; owned debug builds/configs were removed.
- No DEBUG-replay-picker instrumentation remains in application/test source; temporary probes are labelled debug artifacts.
- Independent follow-up review could not start: the previously used child returned agent not found. No replacement reviewer was spawned.
- Remote CI must rerun on the new PR heads; local success does not establish CI success.
