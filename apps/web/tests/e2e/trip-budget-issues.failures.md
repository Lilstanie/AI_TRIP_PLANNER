# Trip budget and issues failure inventory

Public seam: saved fixture Trip opened in the real workspace, desktop and phone, English and Chinese. This is fixture evidence only; it does not verify live price or place providers.

- Missing prices must remain unknown, while a published zero remains a known zero.
- The compact Trip view must retain known estimate, budget limit, incomplete-cost count and an expandable category/item breakdown.
- Item rows must use the current Plan, reconcile to existing category totals, and show only selected booking amounts (not alternatives or duplicate return fares).
- Stays use selected nightly price × rooms × nights; flight fares are already whole-group amounts.
- Over-budget and JPY display must use the Trip's display currency while leaving AUD planning amounts unchanged.
- The issue summary must distinguish time overlap, unlocated place, unpriced cost and failed lookup, with each issue linked to the affected day/Stop.
- Selecting an issue must call the appropriate day/Stop callback; a day selection must remain actionable when there is no located map marker.
- A Plan revision must replace the displayed estimate, breakdown and issue list; stale category/item data must not linger.
- Unknown or conflicting information must not prevent viewing or editing an unrelated Stop.
- English and Chinese labels, accessible names, and budget values must remain understandable at desktop and phone widths.
- The compact unknown-cost count must include unknown priced categories and scheduled activities, count a scheduled restaurant once when its dining idea also appears in the itinerary, and exclude unplanned restaurant suggestions.
- An issue row must perform a real action: itinerary items select their Stop/day; undated category budget items open the budget breakdown and reveal the matching row. Never render an inert button or invent a Stop id.
- Issue details must start collapsed so the timeline remains in the initial Trip viewport; expanding the summary exposes the complete issue list.
