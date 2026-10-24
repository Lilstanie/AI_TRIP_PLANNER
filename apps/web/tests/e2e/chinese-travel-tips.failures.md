# Chinese Travel tips and stop descriptions: failure inventory

Written before the code (#545). Each line is a way the change could fail.

- A Chinese turn still shows English bodies in Travel tips: attractions, customs, safety, entry and
  health, monthly weather, or packing items.
- The entry and health text keeps the English "Verify all entry and health rules…" sentence added in
  code after the model or fallback draft.
- A trip spanning two months keeps the English "Planning context for … only" prefix or English
  month names.
- Weather-grounded packing items (rain, cold, heat) stay English.
- A fallback stop description stays English ("… is a suggested stop; confirm timing …").
- Place names, ratings, nationality or amounts are translated or dropped.
- An English turn changes wording: every English body must stay byte-for-byte.
- A guide or itinerary with no reply language crashes instead of using English.

Run `DATA_MODE=mock pnpm --filter @trip/web e2e chinese-travel-tips`. It taps the
"墨尔本 → 悉尼 · 5 天" / "Melbourne → Sydney · 5 days" chip at 400×800, opens the Trip tab and reads
Travel tips and every stop description. Mock mode has no model key here, so this covers the
deterministic fallback text; model-written text already follows the reply language rule.
