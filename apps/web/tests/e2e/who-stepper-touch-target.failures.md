# Who sheet stepper touch targets: failure inventory

Written before the E2E (#616). The phone Who sheet has ten − / + stepper buttons that measured
40 × 40 px. Each line is a way the fix could fail.

- A stepper button is still under 44 px wide or high on a phone width.
- The hit area grows only visually: a tap 21 px from the centre lands on another element.
- The larger buttons push the count or a row label off the sheet, giving a horizontal scroll.
- A row label is cut or wraps under the stepper at 360 px.
- The buttons stop working: + no longer raises the count, − no longer lowers it.
- The Chinese sheet, with longer labels, overflows where the English one does not.
