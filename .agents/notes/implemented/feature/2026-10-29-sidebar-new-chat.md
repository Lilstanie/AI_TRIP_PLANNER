# Agent Note: Sidebar primary entry is New chat

Status: implemented
Owner: spec #788, ticket #791

## Problem

The desktop sidebar primary entry was New trip. Travellers who only wanted to chat had to start a
trip-labelled blank conversation and open the Where editor first.

## Decision

- The desktop sidebar and tablet navigation drawer primary entry is New chat. It calls
  `session.newChat`, so it opens or reuses a plain blank Chat without the Where editor.
- Ordinary chat replies stay Conversation-only until a saveable Plan exists; Trip association still
  follows the chat-owned generation rule.
- New trip remains on the Your trips page and phone Mine; desktop Chats lists destinations without
  adding a second trip-start control beside the primary New chat.
- While a Chat reply is running, opening another Chat does not abort or cross-write the original
  turn; returning restores that Chat's progress or result.

## Alternatives considered

- Keep New trip as the sidebar primary and add a second New chat row: that restored the duplicate
  start controls the no-Chats-plus note removed.
- Make the sidebar New chat open Where: that would still force trip facts before ordinary chat.

## Consequences

This supersedes in part the [sidebar entries note](2026-10-27-sidebar-entries.md) and the
[sidebar without Chats plus note](../simplification/2026-10-28-sidebar-without-chats-plus.md).
`new-chat`, `sidebar-entries` and `sidebar-no-chat-plus` cover the updated contract.

## Sources

- Spec #788, ticket #791 (TP-151); blocked by chat-owned generation #790.
