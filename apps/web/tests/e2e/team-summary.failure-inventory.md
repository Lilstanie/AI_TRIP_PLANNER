# Team summary failure inventory

Written before the code (#633). Each line is a way the reply summary could fail; the browser journey must distinguish them.

- A saved reply still renders `TeamConversation` rows (`.team-conversation`), or the thinking process under it disappears.
- A planned reply has no summary, or says anything other than "Coordinator + 5 specialists · 1 round" (zh: "协调员 + 5 位专家 · 1 轮").
- A single-mention reply names the Coordinator or more than one specialist instead of "Stay specialist · 1 round", or a custom name is ignored.
- A hand-off reply (decline, Coordinator dispatch, receiving specialist) shows a summary that omits the receiving specialist.
- A budget-conflict revision turn counts one round instead of two.
- A needs-info reply that only the Coordinator wrote shows a summary.
- The summary is not a button, has no accessible name, or its avatars differ from the assistants it names.
- Pressing a summary opens nothing, or opens the latest run instead of that reply's run.
- The panel opened from a summary shows no label for which turn it shows, or the wrong turn.
- A summary-opened run stays in the panel when the next live turn starts, or the button count shows the earlier run.
- Chinese text or custom assistant names appear in English in the summary or the label.
- At 390 width the summary overflows, or the page scrolls sideways.
- A page error is logged.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.
