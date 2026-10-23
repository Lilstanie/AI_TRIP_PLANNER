# Specialist mention failure inventory

Before changing production code, the retained browser journey must distinguish these failures:

- Typing `@` opens no menu of six assistants, or the menu overflows the page at phone width.
- Picking an option inserts nothing into the message, or the wrong name.
- Typing `@` with a default role name in English or Chinese does not resolve to the same specialist id, or the request carries the typed text instead of an id.
- A message without a mention changes: it carries mention ids or skips the Coordinator.
- With a plan, a mention re-runs every specialist, or changes a section other than the mentioned one.
- The reply of a mentioned specialist carries no assistant id, so it shows the Coordinator's icon.
- A change that overruns the budget shows no conflict-check message, names the wrong specialist or saving, or omits the revision score or the stop reason.
- Conflict-check messages look like an assistant's message instead of a rule.
- With no plan, a mention creates a plan or a section, or the Coordinator stops asking for the brief.
- A mention that names the Coordinator or the same specialist twice sends duplicate or unknown ids.
- A stored message without an assistant id fails to render.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.
