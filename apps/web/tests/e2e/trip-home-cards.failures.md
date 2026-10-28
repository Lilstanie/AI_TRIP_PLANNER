# Trip home entry cards: failure inventory

Written before the code (#768, spec #765). Each line is a way the change could fail.

## Which cards appear

- A trip with a plan shows no cards, or shows a card for Ideas, Bookings, Media or Receipts.
- A trip with no plan shows cards. The catalog parser refuses a trip without a plan, so this state is checked as a corrupted catalog that must not render any card or throw.
- A trip with zero stops shows "0 stops" or hides the Itinerary card altogether.
- A trip with no preferences set shows "0" or hides the Preferences card.
- The Calendar card carries a count it has no data for.

## Counts

- The stop count is not the number of scheduled itinerary stops of this trip: it counts ideas, other trips' stops, or the active conversation's plan.
- The stop count reads "1 stops", or the Chinese interface leaves the unit in English.
- The preference count comes from the settings profile instead of this trip, or disagrees with the Preferences panel it opens.

## Destinations

- Itinerary opens the conversation of another trip, or the trip's chat with a different plan than the card counts (a chat row and the trip card load different snapshots).
- Itinerary opens the conversation but leaves the Trip panel closed, shows the Conversation instead of the itinerary, or shows another trip's stops.
- The Trip panel shows a number of stops that differs from the card.
- Calendar opens the Trips tab instead of the Calendar tab, or opens the month of the next upcoming trip instead of this trip.
- Calendar for a trip in the past or far in the future opens the current month.
- Back from the calendar opened this way leaves the traveller on the Trips tab, and a later Calendar from the sidebar stays fixed on the earlier trip.
- Preferences opens the panel of another trip, or opens the conversation without the Preferences panel.
- Opening a card changes the stored catalog beyond the active trip and conversation.
- Back from a destination does not lead to the Trips page.

## Layout and language

- The cards overflow the viewport or overlap the tags on a narrow screen, or are not stacked on a phone-width window.
- A card has no accessible name, or its name omits the count.
- The Chinese interface leaves a card label or count in English.
- The cards repeat text the layout already shows, such as helper copy under the labels.
- On a phone the Trip home shows the cards side by side instead of stacked, or Itinerary does not open the Trip tab.
- The page throws, or the browser console logs an error, on any of these paths.

Run `DATA_MODE=mock pnpm --filter @trip/web e2e trip-home-cards --prod`. The browser catalog holds a Sydney trip
with stops and three preferences, a Melbourne trip with no stops and no preferences, and a Hobart trip in the past,
all local. The script drives the Trips page at 1440×1000, 768×1000 and 390×844, then the Chinese interface, and
writes screenshots and `summary.json` under `output/playwright/trip-home-cards/`.
