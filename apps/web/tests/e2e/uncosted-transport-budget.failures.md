# Uncosted transport budget failure inventory

Written before the implementation change and its browser assertions.

- No transport section, or an empty zero-cost section, must not imply a free fare.
- Transport items with missing prices must remain excluded from the known total and disclosed.
- A published zero price must remain an estimate of zero, not become unknown.
- Positive item prices and legacy positive section estimates must retain their amounts.
- Partially priced transport must retain its known amount and disclose the missing costs.
- Missing transport costs must qualify an under-budget or at-budget status, without hiding an overrun.
- English and Chinese status, category and exclusion text must agree.
- Desktop and phone layouts must not overflow; screenshots and JSON must retain the observed text.

The browser scenarios use saved-plan fixtures, not live provider quotes or model-generated plans.
