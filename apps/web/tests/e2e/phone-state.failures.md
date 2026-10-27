# Failure inventory: phone state restore

Baseline: `origin/main` `25ce9fa`. At 390×844 and 360×800, the restore loop failed after reloading the workspace.

- Observed: before reload, `CURRENT_KEY` and the catalog both selected the second Melbourne Trip. After reload, `restoreWorkspace` started a blank chat and the tab bar contained only Chat, Map and Mine, so selecting Trip timed out.
- Expected: `docs/workspace-ui.md` says refresh starts a blank planning entry and never reopens the last Trip. Chat, Map and Mine alone are available; a saved Trip opens when selected from Mine.
- Diagnosis: test defect. The restore loop asserted that Trip survived refresh, contradicting the documented start-state contract; the revision values were consistent before reload.
- Repair: the journey now verifies the blank entry and Chat/Map/Mine layout restores, reopens the saved Trip through Mine, and then exercises plan editing. No retry or timeout was added.

## 2026-10-26: short phone viewport reply geometry

- Trigger: `phone-state.e2e.mjs` focuses Chat’s composer, then reduces the mocked visual viewport to 490px at 360×800.
- Historical evidence: integration run `1aee8ff2` failed only this assertion at 360×800 (494/495 checks); the equivalent 390×844 assertion passed. Its log and screenshot do not contain the failed run’s element rectangles. The original log remains at `/tmp/trip-redesign-parent-checks/final-editing-e2e.log`.
- Current production geometry: after waiting for the keyboard marker and composer bottom to match the shortened viewport, a direct run against `http://localhost:3130` passed 102/102 checks. At 360×800, stream top/bottom are 206.05/360, composer top/bottom 360/490, whole item top/bottom -39.70/348.45, and reply body top/bottom 16.30/254.27. The wrapper extends 94.19px below the body because it includes reply controls/metadata; both are within the visible stream in this run. At 390×844, stream bottom/composer top are 404, whole item bottom 391.66, and body bottom 297.47.
- Repair: wait for observable keyboard-layout settlement, then assert the reply body intersects the visible stream and both the body and complete reply wrapper (including controls/metadata) end above stream bottom and composer top. No fixed delay or production change. A same-runner control (`PHONE_STATE_FORCE_REPLY_OVERFLOW=1 BASE_URL=http://localhost:3130 node tests/e2e/phone-state.e2e.mjs`) deliberately translates the reply body below the composer; it failed exactly the 360×800 visibility assertion and retained geometry (body top/bottom 516.30/754.27 versus stream bottom/composer top 360). The injected transform is removed before screenshot capture. Green and controlled-failure logs are `/tmp/trip-phone-state-prod-green.log` and `/tmp/trip-phone-state-prod-failure-control.log`; the full-wrapper recheck passed 102/102 and is logged at `/tmp/trip-phone-state-prod-wrapper-green.log`.
- Diagnosis limit: the current geometry establishes the correct visible-body contract and the run passes, but it cannot identify why the historical run failed because that run did not record rectangles. Keep that cause unclassified rather than attributing it to the wrapper/body distinction.
