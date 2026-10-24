# Code-written cost sentence: failure inventory

Written before the code for #542, #475 and #476. The chat reply's cost sentence is built from the plan,
and the model no longer writes amounts. Each line is a way the sentence could still disagree with the
Trip budget card.

1. The total differs from `plan.estTotal`, or is formatted in a different currency from the card.
2. The budget is shown in AUD when the traveller gave it in another currency (`budgetSource`).
3. A category with no amount is listed as included (#542: transport at AUD 0 read as "included").
4. Transport with no priced fare is not named as excluded.
5. Stops without a published price are called free, zero or included (#475), or their count differs
   from the card's (activity items without `estCost`, not counting dining picks).
6. The headroom is described with an adjective ("comfortably under") instead of the exact amount
   (#476), or says "under" when the plan is over.
7. An estimate equal to the budget is reported as under or over.
8. An infeasible plan gives no minimum budget, or one that differs from the floor the fallback uses.
9. The sentence is in English for a Chinese reply, or Chinese for an English one.
10. The model reply still carries its own total, so the reply holds two totals.
11. The sentence is added to a reply that produced no new plan, or added twice.
12. With no budget set, the sentence invents a headroom.
