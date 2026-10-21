# Historical date confirmation failure inventory

- A multiline card answer beginning `Dates: Confirm historical trip` is rejected because confirmation parsing only matches a whole single-line reply; the same past-date card is returned.
- A valid confirmation without a matching preceding assistant prompt is accepted, bypassing the intended confirmation gate.
- A confirmation for a different date range reuses stale conversation history and accepts dates the traveller did not confirm.
- A correction reply containing future dates should proceed with the corrected dates rather than retain the historical dates.
- A Chinese confirmation card answer must follow the same flow without requiring a provider or model call.
- A repeated confirmation after successful planning should not create a confirmation loop or silently alter the dates.

The regression reproduction uses the existing fixture-backed `/api/chat` path and the same multiline answer emitted by the card, then checks the terminal response and retained dates. It does not claim live-model or live-provider behavior.
