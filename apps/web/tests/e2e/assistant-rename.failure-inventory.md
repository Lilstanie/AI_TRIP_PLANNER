# Assistant rename failure inventory

Before changing production code, the retained browser journey must distinguish these failures:

- The assistant settings show no editable name for the Coordinator or any of the five specialists, or the field has no accessible name.
- A rename does not update the chips, the reply bubbles of earlier messages or the Subagent rows without a reload.
- A blank name does not restore the role name in the interface language.
- A name is not trimmed, is accepted beyond the length limit, or collides with another assistant's custom name or default English or Chinese role name, so a mention becomes ambiguous.
- A rejected name is saved anyway, or is rejected with no visible explanation.
- A mention typed with the custom name, the default English name or the default Chinese name does not send the same specialist id, or the request carries the typed name instead of an id.
- A rename makes the assistant unreachable by its old role name.
- Names do not persist across a reload or across trips.
- The settings dialog or the chips overflow the page at phone width, or the page throws an error.

The E2E runs in mock data mode with no keys.
