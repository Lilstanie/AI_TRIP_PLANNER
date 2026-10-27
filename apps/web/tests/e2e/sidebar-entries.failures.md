# Sidebar entries failure inventory

- The expanded sidebar has no New trip entry, or New trip does not open the existing Where dialog on a blank trip.
- The expanded sidebar has no Calendar entry, or Calendar opens the Trips page on the Trips tab instead of the calendar tab.
- Calendar is not marked current on the calendar view, or Trips stays marked current there.
- Switching the Trips page tab by its own tabs leaves the sidebar marking the wrong entry.
- The Chats row has no plus button, or the plus opens the Chats panel instead of starting a new chat.
- The collapsed sidebar drops New trip, Calendar or the Chats plus, or shows them without a tooltip or accessible name.
- Keyboard order skips a new entry, or Enter and Space on a new entry do nothing.
- Chinese shows English labels for New trip, Calendar or New chat.
- The sidebar or page overflows horizontally, or a page error appears.

Run `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e sidebar-entries`; add `--prod` when a dev overlay hides the UI.
The script checks EN/ZH, expanded and collapsed at 1440x1000, and writes screenshots and `summary.json` to `apps/web/output/playwright/sidebar-entries/<LABEL>/`.
This fixture does not verify live providers or authentication.
