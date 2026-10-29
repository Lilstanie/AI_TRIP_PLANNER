# Sidebar primary New chat failure inventory

- Expanded desktop sidebar loses New chat, Chats, Trips or Calendar, or still shows New trip as a sidebar row.
- Collapsed desktop sidebar loses the New chat tooltip or icon, or restores a New trip sidebar row.
- Opening the Chats panel puts New trip into the sidebar, or removes the sidebar New chat entry.
- Enter on New chat opens the Where dialog, or fails to start a blank conversation.
- Tablet navigation drawer still offers New trip, or loses the New chat row.
- Tablet navigation drawer shows a Chats entry that does nothing: it controls a panel that is not rendered, or pressing it changes nothing. The drawer lists its chats inline instead.
- Phone Mine tab loses its Chats section New chat button, or New chat there no longer opens Chat.
- Chinese shows English labels in the sidebar, or the removed label leaves a gap in the layout.
- The page overflows horizontally, or a page error appears.

Run `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e sidebar-no-chat-plus`; add `--prod` when a dev overlay hides the UI.
The script checks EN/ZH, expanded and collapsed at 1440x1000, the tablet drawer and the phone Mine tab, and writes screenshots and `summary.json` to `apps/web/output/playwright/sidebar-no-chat-plus/<LABEL>/`.
This fixture does not verify live providers or authentication.
