# Incomplete brief ask failure inventory

Written before implementation of the guided first question (TP-169).

- A Chinese message gets the English "To start planning, include …" checklist.
- The reply reads like a form listing every field instead of asking the next question.
- A generic word such as 旅游, 旅行, 度假 or 玩 is saved as the destination, so the Where field shows
  it and the ask skips the destination.
- A known destination is ignored, so the dates question does not name the place.
- With one field left, the reply still appends an empty "also tell me" clause.
- A question written by the model is replaced by the fixed ask.
- The `missing` field labels returned to the model change shape.
- An English message typed with the Chinese interface gets a Chinese ask.

Evidence: chat tests cover each item; the web E2E writes the replies it saw for English and Chinese.
