# Trip day tab failure inventory

- Two trip editors could render colliding tab and panel IDs if IDs are derived only from day numbers.
- A tab can have a missing or duplicate ID, or an `aria-controls` value that does not resolve to a panel.
- The selected day heading and timeline can remain outside a tabpanel, leaving the tab-to-content relationship undiscoverable.
- The panel can point to a missing, stale, or non-selected tab through `aria-labelledby` after a click or keyboard selection.
- Adding the panel can change the existing roving tabindex, move focus away from the keyboard-selected day, or stop scrolling the selected day into view.
- The phone shell or Chinese browser locale can expose untranslated or differently wired day tabs while desktop English still passes.

The browser E2E checks ID uniqueness, resolved controls, selected tab/panel labelling, content containment, focus, and selected-day visibility at desktop and Chinese phone viewports. It continues to exercise the existing initial/reopen scroll contract.
