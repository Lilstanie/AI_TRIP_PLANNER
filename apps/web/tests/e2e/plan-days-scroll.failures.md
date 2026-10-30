# Reply day cards scroll failure inventory

Written before the day cards under a planned reply got scroll buttons.

- With a mouse on a 1440 px window, the later day cards sit past the chat column. The strip hides its
  scrollbar and a vertical wheel does not move it, so Day 4 and later cannot be reached by mouse.
- The right edge fades even after the strip is scrolled to its end, so the last card always looks
  cut off.
- After scrolling, the left edge shows no hint that earlier days are hidden.
- A scroll button covers a card's text or click target when no scrolling is possible.
- The buttons take keyboard focus between the cards, or appear on a touch phone where swiping works.
- Scrolling with the buttons animates when the viewer asked for reduced motion.

Evidence: `plan-days-scroll.e2e.mjs` reads the strip's scroll position, edge fades and buttons at
1440 px, 390 px and in Chinese, and screenshots each state.
