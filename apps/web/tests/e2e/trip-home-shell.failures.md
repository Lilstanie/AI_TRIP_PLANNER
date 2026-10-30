# Trip home shell: failure inventory

Written before the code (#766, spec #765). Each line is a way the change could fail.

- A trip card on the Trips page still opens the conversation instead of the Trip home.
- View trip on the calendar, or a trip in the Chats panel search, opens the conversation while the card opens the Trip home.
- Opening a chat from the Chats panel opens the Trip home instead of the conversation.
- Back leaves the Trip home on a different page than Trips, or returns to the Trips tab after the trip was opened from the Calendar tab.
- The heading shows the generated title for a renamed trip, or two identical trips show the same heading.
- A very long title pushes the menu out of view, widens the page past the viewport or hides the back button.
- The tag line shows an empty value (a blank destination, "0 travellers", a zero budget) or repeats the title.
- The tag line disagrees with the plan's brief: wrong dates, wrong traveller count, wrong currency.
- Rename from the menu changes another trip, keeps the old heading, or cancelling the prompt blanks the heading.
- Deleting the trip that is the active one throws "active trip is invalid" and blanks the app.
- Delete from the menu leaves the page on a trip that no longer exists, lands on a blank chat instead of Trips, or shows no Undo.
- Undo does not restore the trip and its chats, or the restored trip is missing from the Trips page.
- A trip deleted from the Chats panel while its home page is open leaves the home page standing.
- Opening the Trip home changes the active conversation or the stored catalog.
- The Chinese interface leaves the back button, menu, menu items or tags in English.
- The back button, the menu trigger or the tag list has no accessible name.
- A trip opened from the Calendar and then deleted returns to the Trips tab instead of the Calendar tab.
- The page throws, or the browser console logs an error, on any of these paths.

Run `DATA_MODE=mock pnpm --filter @trip/web e2e trip-home-shell --prod`. The browser catalog holds a
Sydney trip with a chat, a renamed trip with a very long title, and a Melbourne trip for one traveller, all local. The script drives the Trips page, the calendar and the Chats panel at 1440×1000, then the Chinese
interface, and writes screenshots and `summary.json` under `output/playwright/trip-home-shell/`.
