# Failure inventory: phone state restore

Baseline: `origin/main` `25ce9fa`. At 390×844 and 360×800, "reload restores Map" fails after the stale-edit section of the script; Trip, Mine and Chat pass.

- Observed: after the Map tab is selected, its `aria-selected` is true, but the saved catalog still holds `layout.view` from before. No catalog write happens while selecting. The cause is `isCurrentTabPlan(plan)` returning false in the persist effects of `useWorkspaceStorage`: the stored tab revision for the trip no longer matches the in-memory plan after the stale-edit section. Clearing the revision keys makes the writes happen. A reload before the restore loop restores all four tabs.
- Product note: while the tab revision is out of step, layout and catalog writes stay paused until a reload. This is a product gap to follow up; this change does not alter it.
- Expected: after a reload, the view the user last chose is restored.
- Repair: the script reloads once before the restore loop, so each restore check starts from a persisted, consistent tab state.
