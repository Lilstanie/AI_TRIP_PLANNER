# Trip home send failure inventory

The browser journey `trip-home-send.e2e.mjs` must fail before the implementation if:

- Trip home loses its spacious columns or lacks modest symmetric desktop insets.
- An action card lacks its leading icon or pushes its numeric count onto a second row.
- Selecting a linked Chat or sending from Trip keeps the conversation embedded inside Trip home.
- The home composer sits inside a second painted white frame, border or shadow.
- Action counts include unit labels or sit below their titles instead of at the right edge.
- Trip home uses a separate input instead of Chat's Composer, losing its shared appearance,
  auto-growing textarea, upload control or keyboard-operated agent mentions.
- Clearing multiline text leaves the shared composer taller than its empty Chat counterpart.
- An attachment selected on Trip home disappears from the first request or its saved user message.
- Trip home still exposes a separate Start chat action.
- Focus, typing, clearing, whitespace, IME confirmation or Shift+Enter creates a Chat.
- Enter leaves the text in a newly opened Chat instead of starting exactly one request.
- The first request loses the explicit Trip Plan or Draft and sends an empty `known` payload, the
  previously open Chat's Plan, or a fresh-trip ID.
- Creating the linked Chat and sending its first message adds duplicate user messages or requests.
- Retry creates another Chat, repeats the user message, or targets another conversation.
- Two same-day Chats show only the destination and date, with no message-derived summary, count,
  localized date or forward affordance.
- A manually renamed Chat loses its title when another Trip-home Chat is created.
- Navigating away during generation aborts it or loses progress when the initiating Chat is reopened.
- A pending generation in Trip A disables the first send in Trip B even though no request owns Trip B.
- First send removes the home composer without transferring keyboard focus into the new Chat.
- Opening an older Chat snapshot replaces the Trip's newer Plan.
- A Trip switch carries an unsent draft into the next Trip.
- A long Chat list leaves the desktop, tablet or phone composer outside the viewport or causes
  horizontal page overflow.
- Phone loses its existing Trip navigation affordance, or the composer is unusable at 390 px.
- First send leaves the new Chat below the phone viewport while keyboard focus is already in its
  offscreen composer, or pointer scrolling cannot expose and operate that composer.
- Opening a Chat clips its composer or map below a phone container that cannot scroll.
- The suggestion, Ideas count or Ideas list disagrees about which unscheduled activities and
  restaurant suggestions are eligible.
- A malformed or null dismissal record prevents Trip home from opening or resets its Trip data.
- Dismissing a suggestion does not take effect immediately when storage is full, or the failure is
  not reported.
- The suggestion calls a Plan ready while no activity is scheduled.
- English or Chinese labels, browser errors or external requests regress.

The fixture journey starts with a long same-day Chat history, includes an older Chat snapshot and
unscheduled activity and restaurant Ideas, uses a controlled local NDJSON proxy, blocks external
requests, and records per-profile screenshots plus `summary.json`.

- First send after entering Trip home from Trajectory must reveal Conversation, rather than retain
  the hidden ledger. This precondition is part of the existing first-send journey.
