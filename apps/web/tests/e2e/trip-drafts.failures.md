# Trip draft failure inventory

The agreed seam is the real Trip workspace in a browser with deterministic fixture planning and
place responses. It covers visible state, navigation, retries and confirmation decisions; it does
not establish live-provider correctness or physical-device browser history behavior.

- A time, place-search, note or details field is lost when the Stop row or Trip view unmounts.
- Returning to a day with a draft leaves no usable route back to the exact Stop and field.
- A draft from another Trip appears after switching saved Trips or has its fields mixed into a
  same-id Stop.
- Close, Escape or Back discards a changed field without asking, on any viewport size.
- Continue editing loses the field value or focus; Discard applies the unfinished value.
- A failed time/place save closes the editor or drops values instead of allowing retry.
- A dirty draft is submitted against a newer Plan revision and replaces that revision's field;
  editing the stale field again also replaces its original base and hides the stale warning.
- A successful save leaves the saved field marked as unfinished, or clears an unrelated field.

Each implementation slice starts with one failing browser assertion at this seam. Artifacts belong
under `output/playwright/trip-drafts/<EVIDENCE_LABEL>/`.
