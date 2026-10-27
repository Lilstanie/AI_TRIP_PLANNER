# Trajectory tab and team sheet on the phone failure inventory

Written before the code (TP-76, #672). Each line is a way the phone trajectory could fail; the browser journey must distinguish them.

- The bottom tab bar has no 轨迹 / Trajectory tab, it is not a `role="tab"` with `aria-selected`, or it is smaller than 44px.
- The tab bar overflows 390 px or 360 px, or its tabs overlap.
- Selecting the tab shows nothing, or leaves the chat panel visible with the ledger.
- The tab shows the timeline overview (the "Trajectory timeline" region) on the phone.
- The ledger is empty or missing although the chat has turns.
- Anything scrolls horizontally on the page or inside the ledger panel at 390 px.
- The tab opened before any chat exists throws, or shows a blank panel with no empty state.
- Tapping a record opens no inspector, or the inspector is narrower than the screen (the ledger shows beside it).
- The inspector close button leaves the inspector open, or closing loses the ledger.
- The sheet's six member cards are fewer or more than six, or the Assignments task board is missing after a plan.
- A card for an involved specialist has no action on the phone (disabled).
- Pressing a card leaves the sheet open, does not select the 轨迹 tab, or leaves the Chat or Map panel showing.
- The trajectory after a card press shows records of other specialists, or the bar does not name the specialist.
- Show all records does not clear the filter.
- Pressing a card while the Chat tab is showing and while the Map tab is showing both reach the trajectory.
- Chinese labels appear in English, or English in Chinese, in the tab, the filter bar or the sheet.
- Resizing to desktop width leaves the phone trajectory as the selected view (blank chat).
- A specialist card pressed on the phone is replayed after widening to desktop, so the desktop opens on the Trajectory tab (with the filter) the traveller never asked for.
- The page logs a page error.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.

- The toolbar's Turns and Calls buttons or the search field are under 44px high (issue #686), or the search text is under 16px and iOS zooms on focus.
- A ledger row is not one 56px card, so the rows and the virtual list disagree on height and the list drifts when scrolled.
- A record's text runs past its row or wraps under the next row instead of clipping after two lines.
- The inspector's Summary, Payload and Result controls overlap the rows or the status list, or are under 44px high.

## Simple view as the default (TP-111, #735)

- The phone trajectory opens on the full ledger cards instead of the simple list.
- A simple row is under 44px high, or its avatars and result do not fit on a 360px screen without horizontal scroll.
- The phone has no way to reach the full view, or the switch is under 44px high.
- The summary jump and the team-card jump open the phone trajectory on the full view or at the wrong turn.
- The empty phone trajectory shows a switch or an empty list instead of its one sentence and its Plan in Chat button.
