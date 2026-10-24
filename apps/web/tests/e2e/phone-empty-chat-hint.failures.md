# Phone empty chat hint: failure inventory

Written before the fix (#640). At 520 px and below the empty chat hint said to add trip details
"in the bar at the top", but the fact chips are hidden there. Each line is a way the fix could fail.

- At 375 or 520 px the hint still names the bar at the top (English) or 顶部栏 (Chinese).
- The phone hint names a control that is not visible, or the "Add trip details" button it names is hidden.
- At desktop width the hint stops naming the bar at the top, or the fact chips disappear.
- The Chinese hint keeps the English wording, or the other way round.
