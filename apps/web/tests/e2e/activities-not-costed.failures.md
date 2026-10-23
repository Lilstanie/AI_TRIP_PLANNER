# Activities row when no stop has a price: failure inventory

Written before the E2E (#622). The "Sydney · 4 days" mock plan has four unpriced stops, and the
Activities row read "AUD 0.00 · Estimated · 4 unpriced". Each line is a way the fix could fail.

- Activities still shows a zero amount labelled Estimated.
- The "4 unpriced" count disappears with the amount.
- Accommodation or Meals, which do have prices, switch to "Not costed" too.
- A category with at least one priced stop loses its amount.
- The category amounts stop adding up to the estimated total.
- The Chinese breakdown still shows a zero estimate.
