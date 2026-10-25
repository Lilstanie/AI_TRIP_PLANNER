# Failure inventory: phone state restore

Baseline: `origin/main` `25ce9fa`. At 390×844 and 360×800, the restore loop failed after reloading the workspace.

- Observed: before reload, `CURRENT_KEY` and the catalog both selected the second Melbourne Trip. After reload, `restoreWorkspace` started a blank chat and the tab bar contained only Chat, Map and Mine, so selecting Trip timed out.
- Expected: `docs/workspace-ui.md` says refresh starts a blank planning entry and never reopens the last Trip. Chat, Map and Mine alone are available; a saved Trip opens when selected from Mine.
- Diagnosis: test defect. The restore loop asserted that Trip survived refresh, contradicting the documented start-state contract; the revision values were consistent before reload.
- Repair: the journey now verifies the blank entry and Chat/Map/Mine layout restores, reopens the saved Trip through Mine, and then exercises plan editing. No retry or timeout was added.
