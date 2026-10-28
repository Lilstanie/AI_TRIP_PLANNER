# Trip home walkthrough: failure inventory

Written before the script (#770, spec #765). Each line is a way the whole Trip home could fail when the pieces are used together. The per-ticket inventories hold the detail; this list is the journey.

## Entry points

- The Trips card, a calendar band or a trip in the Chats search opens the conversation, the Trips page again, or a different trip than the one chosen.
- A chat chosen from the Chats list skips the conversation and lands on the Trip home.
- The home page opened from one entry point differs from the page opened from another: other tags, other chats, other cards.
- On a phone the entry points reachable there (Mine tab cards, trip rows in the search) do not open the Trip home, or leave the tab bar and the home on screen together.

## Page content

- The heading is not the trip title, or the tag line shows empty tags, an English unit in the Chinese interface or a raw ISO date.
- The cards show counts that disagree with the Trip panel or the preferences panel they open, or appear for a trip that has no data behind them.
- The map region is missing, has no accessible name, marks a different set of stops than the workspace map, or throws when no place can be found.
- A trip with no stops, no preferences and no chats shows anything but the title, the tags it has, the three cards without counts and the new-chat box.

## Actions

- Rename on the home page keeps the old heading, the old card on the Trips page or the old title in the chat search.
- Delete on the home page leaves the page standing, loses the trip's chats, or the Undo notice on the Trips page does not bring back the trip, its card and its chat link.
- A new chat from the box is not listed afterwards, opens without the typed text or lands on another trip.
- A chat row opens another chat than the one named; the older chat's plan replaces the trip's latest plan after opening it.
- The back button leaves the traveller on the wrong tab of the Trips page, or on the phone on another tab than Mine.

## Layout and language

- The page scrolls sideways, hides the map or the new-chat box, or overlaps the tags at 1440 or 390 wide.
- Chinese leaves a label, count, date or accessible name in English.
- The phone run is not driven by touch, so a hover-only control hides a path that a finger cannot reach.
- The page throws, or the browser console logs an error, on any of these paths.

Run `DATA_MODE=mock pnpm --filter @trip/web e2e trip-home-walkthrough --prod`. The browser catalog holds a Sydney trip with two placed stops, three preferences and two chats, a Melbourne trip on the calendar with one chat, and a Hobart trip with no stops, no preferences and no chats, all local with place lookups stubbed. The script walks the same journey on desktop 1440×1000, on a 390×844 touch phone, and in Chinese on both, and writes screenshots and `result.json` under `output/playwright/trip-home-walkthrough/`.
