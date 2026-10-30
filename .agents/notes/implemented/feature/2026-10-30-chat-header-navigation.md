# Agent Note: Chat identity and Trip membership in the header

Status: implemented

Partly supersedes the desktop tab entry in
[Trajectory tab](2026-10-24-trajectory-tab.md). The ledger and phone modal remain.

## Problem

The owner wants the Chat title and its Trip association visible together, with Mindtrip-style
switching and membership actions. Top-bar view tabs compete with that identity.

## Decision

A Chat that shares its Trip with other Chats gets the title menu. A plain New chat, a Chat outside a
Trip and the only Chat of a Trip show a plain title, because the menu is about choosing among a
Trip's Chats; the only Chat keeps its Trip name and Back. Open items move out of the top bar into the
Trip panel, and data mode and Trip stay at the far right. The menu owns View trip, Switch chat, Move to another trip, Remove from trip, Rename chat
and Delete chat. Its subtitle names the linked Trip. View trip navigates to Trip home; the existing
Trip action opens the itinerary. The switcher excludes the current Chat from its count and creates
linked empty Chats through New chat. Desktop submenus open beside the root; phone submenus replace it.

Trajectory opens from the left sidebar, which also toggles back to Conversation. Return to chat in the
title menu does the same for a linked Chat. The Trip button sits at the far right with no count.
The phone keeps its existing full-screen Agent Team entry. Navigation drawers close on view selection.

Moving or detaching retains Chat identity, messages and existing itineraries. New trip clones the
current Plan with matching fresh Plan and Brief Trip identifiers. Without a Plan it opens Where.
Running turns, pending questions and edits block reassociation; target Trips with writers are disabled.
Stopped or failed cached turns are cleared before reopening a reassociated Chat so old plans and
Retry cannot restore its previous membership. Deleting a Chat keeps its Trip. Opening a Trip after
its last Chat leaves starts with a fresh empty Chat identity, so its retained Plan snapshot cannot
overwrite the departed Chat or restore that Chat’s old membership.

## Alternatives considered

Keeping the top-bar tabs leaves the requested Chat identity and actions scattered across navigation.
Creating another Chat when moving would lose the owner's conversation identity.

## Consequences

Catalog and server contracts remain unchanged. Header actions reuse existing save, conversation
selection, rename and delete paths. Rename and delete confirm in the shared in-app Dialog. Browser fixture evidence covers persistence and responsive menus;
live-provider planning and physical-device keyboards are separate evidence.
