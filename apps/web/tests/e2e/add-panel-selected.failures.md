# Add panel selection failure inventory

Written before the Add panel showed which tab and filter are selected.

- With Add open under a day, Search, Ideas, Saved and Custom look identical, so the traveller cannot
  tell which tab is showing.
- The Places, Stays, Restaurants, Experiences and Events filters look identical, so the traveller
  cannot tell which kind of result a search returns.
- The selected style lands on Close or the Search submit button, which are not choices.
- Choosing another tab or filter leaves the old one looking selected.
- The selected chip is hard to read in dark mode or loses its accessible state.

Evidence: `add-panel-selected.e2e.mjs` compares the computed background and text colour of selected
and unselected chips at 1440 px, 390 px and in dark mode, and screenshots the panel.
