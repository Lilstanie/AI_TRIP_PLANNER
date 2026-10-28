# Trip home chats: failure inventory

Written before the code (#767, spec #765). Each line is a way the change could fail.

- A trip with no chats still shows an empty list, a heading with nothing under it, or an error instead of only the box.
- The list shows a chat that belongs to another trip, a blank chat with no trip, or misses a chat of this trip.
- The list is not newest first, or the order does not follow the last update.
- A row shows no title or no date, shows the date in English in the Chinese interface, or shows a raw ISO string.
- Choosing a row opens a different chat, opens the trip's last chat instead, or leaves the Trip home standing.
- The conversation opened from a row shows the wrong messages, or a plan snapshot that disagrees with the one the Trip panel shows.
- The box starts a conversation that is not linked to the trip, or links it to the wrong trip.
- The box creates a second trip, loses the trip's plan, or opens a blank chat with no plan.
- Submitting an empty box does nothing or throws; submitting text drops the text instead of carrying it into the composer.
- Starting a chat twice leaves duplicate rows with identical times in the wrong order.
- A chat deleted while the page is open stays in the list, or deleting the last chat leaves the page broken instead of only the box.
- A chat renamed from the Chats panel keeps the old title in the list.
- A new chat is started while the assistant is still answering on another chat: the answer lands in the new chat, the other chat loses its messages, or the page throws.
- The list is a bare container with no accessible name, or the box has no accessible name.
- A phone viewport pushes the list or the box off screen or scrolls the page sideways; a very long chat title widens the page.
- The Chinese interface leaves the list name, box name or button in English.
- Opening the home, reading the list or starting a chat changes another trip, or the stored catalog stops parsing after a reload.
- The page throws, or the browser console logs an error, on any of these paths.

Run `DATA_MODE=mock pnpm --filter @trip/web e2e trip-home-chats --prod`. The browser catalog holds a
Sydney trip with three chats (one renamed, one with a very long title), a Melbourne trip with one chat, a
Hobart trip with no chats and a blank chat that belongs to no trip, all local. The script drives the Trip
home at 1440×1000 and 390×844 and in Chinese, and writes screenshots and `summary.json` under
`output/playwright/trip-home-chats/`.
