# Day plan summary from a model draft: failure inventory

Written before the code (#579). The model writes its own `summary`, which can contradict the stops
it returns ("the final day left free for departure" while day 4 has a 09:00 stop). Each line is a way
the change could fail.

- The model's summary reaches the proposal, so the chat says a day is free while the Trip panel shows
  a stop on it.
- The replacement counts activities per day from the model's text or from the planned maximum
  instead of the stops actually kept after validation and revision.
- A day with two stops and a day with one give "up to 1 activity per day".
- A Chinese turn gets the English summary.
- The deterministic fallback summary changes wording.
