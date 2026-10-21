# Planner correctness failure inventory

- A natural-language duration can be interpreted as nights, adding a departure date and planning an extra day. Reproduce with `3 days in Hobart from 1 Mar 2027`; verify the saved inclusive start/end dates and itinerary days.
- A sparse plan can reuse its only grounded place on several days without telling the traveller it is the same place. Reproduce with one grounded candidate over three days; the reply must identify the reused place and its days rather than presenting repetitions as distinct activities.
- The coordinator receives section totals but not activity-level known/unknown price states. It can describe unknown prices as free/zero, or quote an activity amount without reconciling it with the plan total. Verify the deterministic reply carries the same plan total and explicitly excludes unpriced stops; live-model wording remains a separate model-backed check.
- Known estimates can be mistaken for a complete total when unpriced stops remain. Keep the displayed estimate, budget gap and unknown-cost caveat aligned; never infer a zero price from a missing `estCost`.

This inventory separates deterministic application behavior from the reported live-demo model wording. Fixture evidence does not establish live-model reliability.
