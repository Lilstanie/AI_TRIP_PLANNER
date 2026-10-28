# Agent Note: Sidebar without the Chats plus

Status: implemented
Owner: spec #755, ticket #758

## Problem

The desktop sidebar offered two ways to start a conversation: New trip and a plus beside Chats. Two entries
for one job made the sidebar look duplicated.

## Decision

- The plus beside Chats is removed, expanded and collapsed. The sidebar entries are New trip, Chats, Trips
  and Calendar. New trip, which opens the Where editor on a blank trip, is the one way to start a
  conversation from the sidebar.
- The narrow navigation drawer, which showed a New chat row in place of Chats, drops that row too.
- The phone Mine tab keeps its own New chat button in the Chats section; it is a `ChatsPanel` control, not a
  sidebar one.
- `NavButton` loses its `action` prop, `WorkspaceSidebar` loses `onNewChat`, and the `.sidebar-nav__row` and
  `.sidebar-nav__action` styles are deleted. "New chat" stays a string because Mine and blank chat titles use it.

## Alternatives considered

- Hide the plus only when the sidebar is collapsed: the same duplicate remains expanded.
- Keep the drawer New chat row: it would be the only sidebar-level New chat left.

## Consequences

E2E scripts that clicked the sidebar plus now click New trip and close the Where editor, except on the phone
Mine tab. `sidebar-no-chat-plus` covers English and Chinese, expanded and collapsed, with and without saved
chats, the tablet drawer and the phone Mine tab.

## Sources

- Spec #755, ticket #758 (TP-132); the [sidebar entries note](../feature/2026-10-27-sidebar-entries.md).
