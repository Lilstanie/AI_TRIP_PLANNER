# Several-specialist mention failure inventory

Before changing production code, the retained browser journey must distinguish these failures:

- Two mentions in one message send fewer or more than the two specialist ids, or send the Coordinator.
- The same specialist mentioned twice is sent twice or changes the count of dispatched specialists.
- A specialist that was not mentioned starts work, or a section other than the two mentioned ones changes when the plan has no conflict.
- Only one of the two mentioned specialists shows work in the reply, or one of them appears under the Coordinator's icon.
- Each mentioned specialist runs in its own round instead of together, or the conflict check runs once per specialist instead of once after both.
- A budget overrun after both finish shows no conflict, score or stop message.
- The page overflows horizontally at phone width, or throws a page error.

The E2E runs in mock data mode with no keys.
