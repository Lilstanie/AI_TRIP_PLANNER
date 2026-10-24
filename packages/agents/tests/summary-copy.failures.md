# Reply language and specialist summary copy: failure inventory

Written before the code (#492). Each line is a way the change could fail.

## Reply language

- A Chinese message ("去悉尼玩 4 天") resolves to English.
- A mixed message ("去 Sydney 玩") resolves to English because it contains Latin letters.
- An English message sent from the Chinese interface resolves to Chinese.
- A Latin place name alone ("Tokyo", "New York") sent from the Chinese interface resolves to English.
- A message with only a place name in Han characters ("悉尼") resolves to the interface language instead of Chinese.
- A message with only dates, numbers or punctuation ("2026-12-01, 2") ignores the interface language.
- An empty message (attachment only, or a form-started plan) throws or resolves to undefined.
- No interface language and an unclear message resolves to something other than English.

## Summary copy

- An English turn changes wording: every English summary must stay byte-for-byte what it was.
- A Chinese turn still contains an English template word (room, nights, meal budget, day plan, transport option, planning guidance).
- Money, place names, counts and city lists are lost or reordered in the Chinese copy.
- The Chinese destination guide keeps an English month name.
- Optional parts (lowest eligible cost, unpriced legs, unavailable choices, incomplete) appear when absent or vanish when present.
- A specialist with no reply language on its context crashes instead of using English.

## Weather tip lines (#645)

- An English weather line changes wording: forecast, climate and unavailable lines must stay byte-for-byte.
- A Chinese turn still shows an English day name ("Fri, 18 June") or an English month.
- A Chinese turn keeps an English label (forecast, historical climate, weather unavailable).
- The Chinese day text differs from the Trip tab day header for the same date.
- The provider's weather summary or the city name is dropped or translated.
- A date is shifted by the server's time zone, so the day name is one day off.
- A guide with no reply language crashes instead of using English.
