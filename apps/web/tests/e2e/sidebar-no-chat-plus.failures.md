# Sidebar without the Chats plus failure inventory

- Expanded desktop sidebar still renders a New chat button, or any extra button, beside the Chats entry.
- Collapsed desktop sidebar still renders a New chat button under the Chats icon, or loses New trip, Chats, Trips or Calendar.
- No saved chats: the plus still shows, or Chats shows a count other than 0.
- Saved chats: opening the Chats panel brings back a New chat button in the sidebar.
- New trip stops opening the Where dialog on a blank trip, or the dialog does not take focus.
- Keyboard order of the sidebar entries changes, or Enter on New trip does nothing.
- Tablet navigation drawer still offers a New chat row beside Chats.
- Phone Mine tab loses its Chats section New chat button, or New chat there no longer opens Chat.
- Chinese shows English labels in the sidebar, or the removed label leaves a gap in the layout.
- The page overflows horizontally, or a page error appears.

Run `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e sidebar-no-chat-plus`; add `--prod` when a dev overlay hides the UI.
The script checks EN/ZH, expanded and collapsed at 1440x1000, the tablet drawer and the phone Mine tab, and writes screenshots and `summary.json` to `apps/web/output/playwright/sidebar-no-chat-plus/<LABEL>/`.
This fixture does not verify live providers or authentication.
