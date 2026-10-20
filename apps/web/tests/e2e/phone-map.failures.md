# Failure inventory: phone touch targets #460 and #461

`phone-map.e2e.mjs` uses mock planning and place data and disables WebGL explicitly to exercise the map-unavailable fallback. It records geometry, keyboard behavior and screenshots; it does not establish live renderer, provider or physical-device behavior.

- The day-chip hit box remains below 44 px, or visual styling expands the pill in a way that disrupts the sheet layout.
- A larger day-chip hit box overlaps the sheet handle, adjacent chips, or stop content and sends a tap to the wrong action.
- The selected-day visual state, `aria-pressed`, keyboard focus ring, keyboard activation, or day-to-map ownership/disclosure behavior changes.
- Trip budget or Travel tips summaries remain below 44 px, or added space changes disclosure open/closed state or their click target.
- Summary content, icons, focus rings, or long/chinese labels clip or overflow at 320–520 px.
- A phone-only selector leaks to the 521 px/tablet or desktop layout.
- Added vertical space produces horizontal page overflow or hides content below the phone tab bar.
- Browser viewport transitions across 520/521 px leave the controls unreachable or focused state lost.
- Desktop target dimensions and the existing map selection and disclosure behavior regress.
