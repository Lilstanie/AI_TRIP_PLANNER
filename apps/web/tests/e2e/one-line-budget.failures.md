# One-line budget: failure inventory

Written before the code (#757, spec #755). Each line is a way the feature could fail. The agreed seam is the real Trip workspace in a browser at 1440x1000 with a mouse and at 390x844, a saved fixture Trip in local storage, in English and Chinese. It covers what the traveller sees.

## Collapsed line

- The budget takes more than one text line plus the bar, or the summary shows the estimated total twice.
- The known total is not shown over the budget limit, or the limit is missing when one is set.
- No limit set: a saved plan whose limit is zero or missing is refused when restored, so the panel never shows a limit of zero; a restore that crashes the page or shows "NaN" is a failure.
- Every item unpriced: the total shows a made-up amount instead of zero known, or the unpriced count is missing or smaller than the number of unpriced items.
- Nothing unpriced: an unpriced count of zero is shown.
- Over budget: the status does not say so, the bar is not capped at full, or the bar is not marked over.
- At budget or under budget with unpriced items: the caution wording is dropped.
- A currency other than AUD: the total or the limit is shown in AUD, or the two use different currencies.
- A long status wording or a Chinese label overflows the panel, wraps the amounts apart, or makes the page scroll sideways at 390 px.
- The summary is not a button that tells assistive technology whether it is open, or it has no accessible name.

## Expanded list

- Tapping the line does not expand, or expanding moves the line.
- A category has more than one line, shows provider text, item names or a nested list.
- A category shows an invented zero where no cost is known instead of "Not costed".
- The categories do not add up to the known total.
- The status wording appears a second time inside the expanded list, or the estimated total is repeated.
- The "Not included" notes, the delta sentence or the "Estimated" suffix still appear.
- Conflicts that concern the budget disappear with the removed text.
- The provider details are gone from the stop or booking row as well.
- Collapsing again leaves the list visible.
- Opening or closing the On trip day state changes a manual choice of open or closed.

## Languages and sizes

- A label that is new or changed has no Chinese translation, or a removed string stays in the message tables.
- Chinese labels differ between the visible text and the accessible name.
- The summary is shorter than 44 px on a phone.
