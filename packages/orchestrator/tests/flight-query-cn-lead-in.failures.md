# Chinese flight query lead-in failure inventory

Written before the fix for the limitation left by
[flight-query-lead-in.failures.md](flight-query-lead-in.failures.md). Han text has no word boundary,
so a lead-in that is not in `LEADING_CN` and has no `从` ("你好洛杉矶到东京") stays in the origin, and
the flight search is asked for the airport code of "你好洛杉矶", which it does not have.

- A greeting or other unlisted lead-in glued onto a known city ("你好洛杉矶", "您好里约热内卢",
  "早上好悉尼", "请问一下北京") stays in the origin.
- The fix cuts a city name in the middle: a longer known name loses its front ("里约热内卢" read as a
  shorter match), or a name that ends in a shorter known name is cut to that shorter name.
- The fix depends on word segmentation (`Intl.Segmenter`), which splits "悉尼" into "悉|尼" and
  "布宜诺斯艾利斯" into five pieces, so cities break apart.
- The fix drops an origin that is not in the airport table ("你好成都" when 成都 has no mapping), so a
  city the table later learns is silently lost; an unknown origin must stay as it was.
- The fix changes an English origin, which already has word boundaries and the three-word rule.
- The fix lets a planning request, an edit, an undated message or a same-city pair ("你好东京到东京")
  through as a flight question.
- The fix stops the existing Chinese forms ("悉尼到首尔的机票", "从北京飞东京", "帮我查一下最便宜的从洛杉矶
  到东京的机票") from parsing.
- The city lookup the parser needs is a second copy of the airport table, which drifts from the
  one the flight search uses.
- The lookup leaks raw provider adapters through the `@trip/tools` entry point, or widens it without
  updating `public-boundary.test.ts`, the architecture page and its Chinese pair.
