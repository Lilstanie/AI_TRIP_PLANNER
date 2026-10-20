# Sidebar search count failure inventory

- One matching trip or chat is announced with an English plural.
- Multiple matches incorrectly use singular wording.
- Zero matches lose the existing empty result announcement.
- Idle or cleared search announces stale result counts.
- Chinese falls back to English or changes its natural counting wording.
- Desktop or phone loses either polite live region.
- Clearing search loses input focus, or the page overflows horizontally.

Run `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e sidebar-search-counts`.
The isolated browser catalog contains two matching trips and two renamed chats.
The script checks EN/ZH at 1440×1000 and 390×844 and writes screenshots and a JSON report.
This fixture does not verify live providers or authentication.
