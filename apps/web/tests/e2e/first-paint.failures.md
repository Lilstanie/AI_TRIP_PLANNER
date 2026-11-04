# First paint failure modes

Written before the fix (2026-11-04), from frame-by-frame captures on `main` at 1440 × 1000.

- A browser that prefers Chinese, with no saved language, paints the sidebar in English
  ("New chat", "Chats") before it switches to 新聊天.
- A saved dark appearance paints the workspace on the light page colour before it turns dark.
- A saved light appearance on a dark system paints dark before it turns light.
- A saved language or appearance stops applying after the fix (regression guard).
