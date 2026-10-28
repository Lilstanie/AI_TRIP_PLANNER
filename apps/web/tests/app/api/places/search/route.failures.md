# Place search route query length: failure inventory

Written before the fix (TP-129, review of spec #743). The seam is the route handler with a mocked provider.

- A 200-character query with a kind reaches the provider longer than 200 characters.
- A short query with a kind loses its kind word.
- A query with no kind is changed.
- A query over 200 characters is accepted.
