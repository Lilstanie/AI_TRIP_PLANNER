# Trip budget and issues failure inventory

Public seam: saved fixture Trip opened in the real workspace, desktop and phone, English and Chinese. This is fixture evidence only; it does not verify live price or place providers.

- Missing prices must remain unknown, while a published zero remains a known zero.
- The compact Trip view must retain known estimate, budget limit, incomplete-cost count and an expandable category/item breakdown.
- Item rows must use the current Plan, reconcile to existing category totals, and show only selected booking amounts (not alternatives or duplicate return fares).
- Stays use selected nightly price × rooms × nights; flight fares are already whole-group amounts.
- Over-budget and JPY display must use the Trip's display currency while leaving AUD planning amounts unchanged.
- The open-items popover must distinguish time overlap, unlocated place and failed lookup, with each open item linked to the affected Stop.
- Selecting an open item must call the appropriate day/Stop callback; a day selection must remain actionable when there is no located map marker.
- A Plan revision must replace the displayed estimate, breakdown and open-item count; stale category/item data must not linger.
- Unknown or conflicting information must not prevent viewing or editing an unrelated Stop.
- English and Chinese labels, accessible names, and budget values must remain understandable at desktop and phone widths.
- The compact unknown-cost count must include unknown priced categories and scheduled activities, count a scheduled restaurant once when its dining idea also appears in the itinerary, and exclude unplanned restaurant suggestions.
- Unpriced items must not be counted or listed as open items; they remain only as the budget's "Not included" note.
- The Trip issues block must be gone from the Trip panel on desktop and phone, in English and Chinese.
- The badge next to the trip title must show time conflicts + unlocated places + failed lookups, and be absent when the count is zero.
- Selecting a popover row must select its Stop and close the popover; Esc and an outside click must also close it.
- The popover must use the `glass-float glass-float--raised` contract with opaque rows, and must not push the timeline down.
- The badge and popover must work at 390px phone width beside the phone trip title, without horizontal overflow, in English and Chinese.
