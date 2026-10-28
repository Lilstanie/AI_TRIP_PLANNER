# Mention revision keeps day notes: failure inventory

Written before the fix (TP-129, review of spec #743). The seam is `runTripChat` with a mention and a saved plan whose Brief now covers fewer days than the notes do.

- A Day title or note keyed beyond the rebuilt plan's last day survives the mention revision.
- A Day title or note on a day that still exists is dropped by the mention revision.
- A plan with no day notes gains an empty `dayNotes` map after the revision.
- A mention revision whose Brief keeps every day changes the notes at all.
