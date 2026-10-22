# Trip rename and delete failure inventory

- A trip row in the Trips list, or a trip card on the Trips page and the phone Mine tab, has no Actions menu, so a trip cannot be renamed or deleted.
- Opening the Actions menu on a trip card also opens the trip.
- A rename is shown in the Trips list but not in the Trips page card, the calendar bar or the top title.
- Cancelling the rename prompt, or entering only spaces, changes the name.
- The name is lost when the trip is replanned from chat, because the saved trip record is rebuilt from the plan.
- The name is lost after a reload, because the stored trip record drops the rename.
- Deleting a trip also deletes its chat.
- The deleted trip comes back on the next save because its chat is still open and saves its plan again.
- Undo does not bring back the trip, or brings it back without its name or without its link to the chat.

The browser journey uses fixture plans in mock mode with local storage; it does not cover account sync with a real database.
