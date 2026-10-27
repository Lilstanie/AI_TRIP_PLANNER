# Chat memory cancellation failure inventory

- The client disconnects after planning completes while the account-memory update is still pending; the update commits without sending its memory notice or Undo token.
- The client disconnects before the account-memory transaction begins; the handler still opens a transaction and may persist the preference.
- The client disconnects while the update query is in flight; the database write finishes, but the handler fails to notice cancellation before commit.
- A cancellation-triggered rollback closes the Neon client and preserves any earlier operation error.
- Cancellation arrives after the final in-transaction signal check but before the physical commit; it may be too late to prevent the commit, so Settings remains the recovery path if the completion response is lost.
