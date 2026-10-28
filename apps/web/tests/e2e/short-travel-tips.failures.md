# Short Travel tips at the bottom: failure inventory

Written before the code (#762, spec #755). Each line is a way the change could fail. The agreed seam is the real Trip workspace in a browser at 1440x1000 with a mouse and at 390x844, a saved fixture Trip in local storage, in English and Chinese, plus a mock `POST /api/chat` plan for the newly planned trip. It covers what the traveller sees and what the plan stores.

## Panel order

- Travel tips still sit above the days, the ideas chip or the budget line.
- The order differs on the phone Trip tab from the desktop panel.
- Travel tips are open on first load of a trip with no saved preference.
- The per-trip folded preference (`trip-tips-folded:<tripId>`) stops working: an open choice does not survive a reload, or one trip's choice leaks into another trip.
- Moving the block loses its fold animation, its 44 px phone target or its Chinese label.
- A plan with no tips shows an empty row or a heading with nothing in it, or leaves a gap.

## Old plan with long tips

- More than five items render.
- An item shows its full paragraph instead of its first sentence.
- A first sentence is cut at a decimal rating ("4.5"), an abbreviation ("St. Kilda") or a Chinese full stop followed by no space.
- A sentence is cut after "a.m."/"p.m.", dotted initials ("U.S."), "e.g." or "i.e.", a month abbreviation or a single letter.
- An old safety or entry tip begins with the "Planning context for ... only; recheck ..." scope sentence, so only that scope sentence is shown instead of the tip.
- A tip with no full stop is dropped, emptied or shown with an added full stop.
- Packing items still render as a bulleted list rather than one comma-separated line.
- An item whose detail is blank but has packing is dropped.
- The dated weather lines (one per city and day) are cut to the first line; they are evidence, so the weather tip is shown whole.
- Item order changes, so the first five are no longer the first five saved.

## Newly planned trip

- More than five tips are stored in the destination guide.
- A stored tip has more than one sentence, including the cross-month scope prefix and the entry and health verify sentence.
- Packing is longer than four entries or is stored as a long list.
- The cross-month scope disappears from weather, safety and entry tips.
- The entry and health caution to verify against official sources disappears from the tip itself (a short clause stays in the tip; the long sentence stays in the assumptions).
- More than one place to explore is generated.
- English wording of the first sentences changes unexpectedly, or a Chinese turn returns English tips.
- The model draft is longer than allowed and the output is cut mid-sentence.

## Checks around it

- `packages/shared` changes, or the plan type gains a field.
- A guide with a single customs sentence and no full stop is emptied.
