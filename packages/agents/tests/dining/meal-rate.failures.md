# Fixed meal rate: failure inventory

Written before the code (#639). Each line is a way the change could fail.

- The same brief gives a different Meals amount when the model answers, fails or is absent.
- A model draft's own per-person figure still reaches the total or the meal-budget line.
- The rate ignores the budget: a small budget gets AUD 80 per person per day and the meal line
  exceeds what the plan leaves for meals.
- A budget revision no longer cuts the meal envelope by 30 percent.
- An allocation from the budget pass is ignored, or raises the rate above AUD 80.
- The meal-budget line's "per person/day" amount differs from the rate used in the total.
- The model is no longer told the per-person/day figure, so its venue picks ignore price level.
- A model draft is rejected for a figure the planner no longer uses.
