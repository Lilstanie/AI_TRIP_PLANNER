# Phone sheet targets: failure inventory

`phone-sheet-targets.e2e.mjs` measures controls a thumb uses on a 390 × 844 phone, in English and
Chinese. It must fail when:

- A sheet's Close button or primary action is under 44 px (#503).
- A Personalization edit row or a control inside its editor is under 44 px (#556).
- In the When sheet, a day cell, either month arrow or Clear is under 44 × 44 px (#588).
- The When sheet shows no day cells or no month arrows, so nothing was measured.
