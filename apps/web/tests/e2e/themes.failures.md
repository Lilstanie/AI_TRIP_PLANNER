# Theme and accent failure modes

Written before the theme code (2026-11-09, TP-381).

- A saved theme or accent paints the default blue page first and switches only after hydration.
- City night or OLED black, chosen with the Light appearance, renders light tokens.
- An accent choice loses to the travel theme's own accent, or only applies in one scheme.
- A theme drops body text, secondary text or accent text below WCAG AA on its page or surface,
  or white text below AA on its filled accent.
- High contrast still blurs or tints the glass surfaces.
- The iOS shell's glass values win over the theme, so the iOS app shows the default glass.
- A theme picked in Settings is lost on reload.
- The appearance row still offers Light for a dark-only theme.
