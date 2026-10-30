# Reply day cards failure inventory

Written before implementation of the day cards under a planning reply (TP-171).

- A planned reply is only a paragraph, so the traveller cannot see or reach a day from the chat.
- Cards appear under every old reply and show today's plan beside a reply about an older plan.
- A day with no stops is dropped, so the card count differs from the trip length.
- A day card opens the trip on Day 1 instead of the day that was clicked.
- On a phone the card opens nothing because the trip lives in another view.
- Long stop names or many stops overflow the card or the page width.
- Day names and the free-day text stay in English with the Chinese interface.
- The entrance animation runs with reduced motion, or replays on every re-render.
- A reply that only asked a question, or a plan with no dates, renders empty cards.

Evidence: `reply-day-cards.e2e.mjs` writes screenshots and a summary for desktop, phone and Chinese.
