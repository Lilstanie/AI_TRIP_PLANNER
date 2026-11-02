# Edit to named days: failure inventory

Written before the code (TP-284). A change to named days keeps every other day and drops edited-day
stops that repeat a kept place. Each line is a way that could fail.

- Every new stop for an edited day repeats a kept place, so the day ends empty although it had stops
  before the edit.
- The edited day keeps its old stops even when the edit brought new ones.
- A day that had no stops before the edit gains old stops from another day.
