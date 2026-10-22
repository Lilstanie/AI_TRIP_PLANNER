# Failure inventory: drawer walkthrough

Baseline: `origin/main` `25ce9fa` (2026-10-21), `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e drawer-walkthrough`, runner `output/e2e/runner/2026-10-21T13-40-34-278Z.json`. The 1440px en pass is green; the 1440px zh pass times out.

- Trigger: zh pass sends the translated example chip. Mock/offline planning reads English only (`packages/orchestrator/src/chat-offline.ts`); the zh chip is answered with "include the destination", so no trip is created and `.trip-editor` never renders. Probe on `origin/main` `25ce9fa`: the zh chip shows "To start planning, include the destination."; the English example in the zh UI plans and renders `.trip-editor`.
- Expected: the zh pass exercises the zh trip UI on a real plan, so the walkthrough must reach a plan without a model key.
- Would hide a regression: a zh-only break in the trip drawer would be masked if the English prompt bypasses the zh chip entirely, so the zh UI assertions (labels, Open-trip button, stop saves) still run on the zh interface language.
- Repair: the zh pass types the English example through `startExamplePlan` (`trip-setup.mjs`); the en pass still clicks the chip.

## Second zh failures after the planning fix

With the English prompt in place, the 1440px zh pass ran further and failed two checks, both timing races rather than product output:

- "Undo restores the second stop's time and clears its conflict" read the stops 900 ms after Undo; the undo applies after the `preview-edit` answer. Expected: the check waits until the stops match the state before the overlap. Repair: `until` on the day rows (15 s).
- "the stay card offers an Alternative" counted `.alternatives__pick` immediately after opening the booking card. Its alternatives mount after the click, and the zh screenshot shows three of them. Repair: wait for the first pick to attach (10 s) before counting.
