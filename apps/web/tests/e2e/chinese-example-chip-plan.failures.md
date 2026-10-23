# Chinese example chip in mock mode: failure inventory

Written before the E2E. With the Chinese interface and no model key, the first example chip
("悉尼 · 4 天") sends "计划一次为期 4 天的悉尼之旅……" and the reply asks again instead of planning,
because the offline reader finds no destination in "X之旅". Each line is a way the fix could fail.

- The reply still asks for a destination and the Trip tab stays empty.
- The destination is read with extra words ("为期 4 天的悉尼" or "悉尼之旅").
- The plan has the wrong length: not the chip's day count.
- "从墨尔本前往悉尼的旅行" is read as destination "悉尼的" or origin "墨尔本前往悉尼的旅行".
- The English chip stops planning.
- Another Chinese example chip still gets no plan.
