# Phone empty chat hint: failure inventory

Written before the fix (#640). At 520 px and below the empty chat hint said to add trip details
"in the bar at the top", but the fact chips are hidden there. Each line is a way the fix could fail.

- At 375 or 520 px the hint still names the bar at the top (English) or 顶部栏 (Chinese).
- The phone hint names a control that is not visible, or the "Add trip details" button it names is hidden.
- At desktop width the hint stops naming the bar at the top, or the fact chips disappear.
- The Chinese hint keeps the English wording, or the other way round.

## TP-112: one sentence, one action on every empty phone screen (#738)

Written before the fix, from fixture-mode screenshots at 390x844 and 360x800 in English and Chinese
(`output/playwright/phone-empty-chat-hint/before/`). The rule from #737: one sentence, one primary action,
and no message said twice on a screen. Each line is what repeats or is extra today, and so a way the fix
could fail.

- Chat, empty: the composer placeholder asks where to go, and a persistent footer adds a second sentence,
  "Estimates require verification. Nothing here makes a booking.", although there is no estimate yet.
- Mine, no trips: the empty line says "No trips yet. Start one with New trip, or describe where you want
  to go in a chat." It is two sentences naming two actions, and it names the New trip button that sits
  directly above it.
- Mine, no trips: a Trips/Calendar switch, a search field and a Chats section with its own New chat button
  and a blank "New chat" row all show with nothing to switch, search or open. The label "New chat" appears
  twice and "New trip" twice.
- Trip tab, a day with no stops: "Nothing planned for this day yet. Ask in the chat to add something, or
  move a stop here from another day." is two sentences and two instructions that repeat the Ask AI about
  this day and Add place buttons beside it.
- Trajectory sheet, no records: "Nothing here yet. Send a message in Chat and each step the assistant takes
  will be listed here." is two sentences and says Chat above a Plan in Chat button.
- Trip drawer without a plan on a phone: one sentence, but two buttons, Plan in Chat and Add trip details.
- Map without a trip (#737): already one hint and one button; it must stay that way and still hold at
  390x844 and 360x800.
- The Chinese strings keep the English structure (two sentences) or lose their English pair.
- A screen with data (trips, chats, a day with stops) loses its search, switch or Chats section.
