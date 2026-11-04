# Flight query lead-in failure inventory

Written before the `PAIR` fix in `packages/orchestrator/src/chat/flight-query.ts`. The origin
capture was a lazy run of at most 31 characters matched from the leftmost position, with `from`
optional. A lead-in that pushes the origin past that window starts the capture mid-word, so the
origin is decided by the length cap rather than by the word that introduces it.

- A long English lead-in before a multi-word origin ("cheapest flight from Los Angeles", "the
  cheapest one way flight from Rio de Janeiro", "find me the cheapest flights from New York City")
  is cut mid-word ("heapest flight from Los Angeles"), `city()` cannot strip the fragment, and the
  question goes to the coordinator model instead of the model-free flight answer.
- "I want to fly from Sydney to Tokyo" matches the first " to " and returns the origin "I want" and
  the destination "fly from Sydney to Tokyo": a wrong answer, not a declined one.
- A Chinese lead-in longer than ten characters before `从` is cut mid-phrase and the fragment is
  kept in the origin ("一下最便宜的从洛杉矶", "最便宜的从里约热内卢"), so the provider is asked for a city
  that does not exist.
- A Chinese "cheapest" lead-in without `从` ("最便宜的洛杉矶到东京") keeps "最便宜的" in the origin, while
  the English parser already strips "cheapest".
- The fix only raises the cap, so a slightly longer lead-in fails the same way.
- The fix lets a planning request, an edit to an open trip, a message without a flight word, a
  message without a date, or a same-city pair through as a flight question.
- The fix stops the existing short forms ("sydney to seoul flight", "flights Sydney to Singapore",
  "悉尼到首尔的机票", "从北京飞东京") from parsing.
- A Chinese lead-in that is not a known lead word and has no `从` ("你好洛杉矶到东京") still glues onto
  the origin, because Han text has no word boundary to cut at. This is a known limitation, not
  covered by the fix.
