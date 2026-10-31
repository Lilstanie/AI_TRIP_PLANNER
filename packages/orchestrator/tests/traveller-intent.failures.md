# Traveller intent from the chat model: how it could fail

Written before the code for TP-202. On a real six-day Tokyo trip the traveller asked for packed days
and got 14 stops. The brief model had understood the request but kept it only as free text. The
code after it then applied its own limits and keyword lists: 1–3 activities a day in the prompt,
2 fallback slots, dietary words, English memory sentences, and a regex party count that replaced
the model's.

## Brief and contract

1. The model hears "特种兵", "排满", "voll durchplanen" or "as much as possible" and records no pace:
   `intent.pace` must be `packed` whatever the language or wording, and `relaxed` for "慢慢玩" or
   "take it easy".
2. A pace from an earlier turn is lost when a later turn sets only a dietary need: intent fields
   merge, so a later update keeps fields it does not mention.
3. A pace written in Settings ("Packed days: see as much as possible") never reaches the intent:
   the model reads knownSoFar.preferences as well as the message.
4. An intent value outside the contract (pace "fast", rating 12, an unknown stay type) breaks the
   brief: invalid fields are dropped, and the rest of the update still applies.
5. The web workspace drops the intent when it rebuilds the brief from its draft: intent survives
   every draft and brief conversion.

## Planner

6. A packed pace still gets at most 3 activities a day: the model is asked for 4–6 sights a day plus
   lunch and dinner, and the fallback plans 4 sights and 2 meals a day.
7. A relaxed or default pace changes: relaxed stays at 1–2, balanced at 2–3, and the fallback keeps
   its current slots for both.
8. A packed day crams stops that cannot be reached: every stop still needs the route time plus the
   15-minute buffer, and the fallback leaves at least 30 minutes between stops.
9. A packed day on the landing day ignores the flight: slots before landing plus 90 minutes are still
   skipped.
10. Dining searches without a dietary need the model recorded in another language ("no pork",
    "sin gluten", "牛肉不吃"): dining reads `intent.dietary` first, and the keyword list is used only
    when there is no intent.
11. A stay that breaks a stated hard requirement ("at least 8", "must have free cancellation",
    "民宿") is chosen: accommodation filters candidates by `intent.stay`, which wins over the account
    memory.
12. An interest stated in Chinese ("历史", "博物馆") never changes the ranking: `intent.interests` uses
    the contract's interest names, which rank matching place categories first.

## Party and days

13. With a model, a regex count replaces the model's group size or trip length: the regex applies
    only when no model produced the update.
14. Without a model, the offline path stops finding the party or the trip length: the local
    extractor still sets both.

## Account memory

15. "我一向喜欢特种兵式旅行" or "we always travel vegetarian" is not remembered: the model returns
    lasting preferences in any language, and those are saved to the account.
16. A wish for this trip only ("这次想轻松点") is saved to the account: the model saves only what
    the traveller says applies to every trip.
17. Without a model, the English memory sentences stop working: the regex remains the fallback.
