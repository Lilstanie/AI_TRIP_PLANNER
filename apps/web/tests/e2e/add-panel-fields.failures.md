# Add panel field failure inventory

Written before Add panel fields got the shared field style.

- On the Custom tab, Start time and Note have no border or fill, so they read as plain text and the
  traveller cannot see where to type.
- The search box is shorter than the Search button beside it, so the row looks misaligned.
- Fields in the panel use a different height, border or corner than the stop editor's fields.
- The field border disappears in dark mode.
- The Keep open checkbox is stretched into a text field by the new rule.

Evidence: `add-panel-fields.e2e.mjs` reads the computed border, height and radius of every Add panel
field at 1440 px, 390 px and in dark mode, compares them with a stop editor field, and screenshots
the panel.
