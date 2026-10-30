# Chat title failure inventory

Written before a chat that plans a trip was named after the trip.

- After planning, the chat header, the Chats list and Trip home show the whole first message
  ("Plan 4 days in Lisbon from Sydney, 2 people, …"), cut off mid-word, instead of the trip.
- The title repeats the traveller's own prompt, so two chats that asked for the same city with
  different wording look unrelated, and two trips cannot be told apart by place and dates.
- A later chat started from Trip home takes the trip's name too, so a trip's chats all read the same.
- A chat the traveller renamed loses its name when the plan changes.
- In Chinese the trip dates stay in English.
- Before any plan exists, the chat has no readable title.

Evidence: `chat-trip-title.e2e.mjs` plans a Lisbon trip at 1440 px in English and in Chinese, reads
the chat header, the Chats list and Trip home rows, starts a second chat from Trip home, renames a
chat, and screenshots each step.
