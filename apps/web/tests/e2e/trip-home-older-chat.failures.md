# Trip home older chat: failure inventory

Written before the code (#770, spec #765). Each line is a way the change could fail.

- Opening a chat row whose snapshot is older than the trip's snapshot loads the chat's older plan, and the save that follows overwrites the trip's plan with it: the trip loses stops it had.
- The Trip home card reads fewer stops after the traveller only opened a chat and went back.
- The opened chat shows the older plan in the Trip panel while the trip record holds a newer one, so the two disagree.
- Opening the chat and saving writes the older plan into the other chats of the trip, or changes another trip.
- The newer plan is shown but the chat's messages, input or pending question are lost, or replaced by another chat's.
- An edit the traveller makes after opening the older chat is dropped, or applied to the older plan instead of the latest one.
- A chat whose snapshot is newer than the trip's snapshot opens with the trip's older plan.
- A chat with no snapshot of its own opens without the trip's plan.
- The older chat is the active chat when the app reloads and the reload restores its older plan over the trip's.
- The page throws, or the browser console logs an error, on any of these paths.

Run `DATA_MODE=mock pnpm --filter @trip/web e2e trip-home-older-chat --prod`. The browser catalog holds a Sydney trip
with two scheduled stops whose only chat holds an older snapshot with none, and a Hobart trip whose chat holds a
newer snapshot with two stops than the trip's one. The script drives the Trip home at 1440×1000 and writes
screenshots and `summary.json` under `output/playwright/trip-home-older-chat/`.
