# Assistant team conversation failure inventory

Before changing production code, the retained browser journey must distinguish these failures:

- A planned turn shows no Coordinator dispatch message, or shows one that no `coordinator` event produced.
- A specialist that finished has no message of its own, or a message appears for a specialist that never ran.
- A message shows no icon, a shared icon, or a role name in the wrong interface language.
- A message does not say whether an LLM or code decided the step, or marks both the same way.
- A specialist message omits its data source (live, estimated, mock, fallback).
- The Think transcript is gone, or its Subagent rows keep the generic icon instead of the assistant icon.
- A screen reader cannot tell which assistant a message belongs to.
- A stored message without an assistant id fails to render.
- The layout overflows horizontally at phone width, or the Chinese interface shows English role names.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.
