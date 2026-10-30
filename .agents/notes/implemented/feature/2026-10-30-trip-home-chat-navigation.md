# Agent Note: Trip home opens the normal Chat workspace

Status: implemented

Partly supersedes the embedded-conversation navigation in
[Trip home actions](2026-10-29-trip-home-actions.md) and
[Trip home first send](2026-10-29-trip-home-send.md).

## Problem

The owner expects a Chat opened from Trip to use the same workspace as a Chat opened from the
sidebar. Embedding it in Trip duplicated navigation, focus handling and error presentation.

## Decision

Selecting a linked Chat uses the existing conversation-selection action. Sending the first message
or choosing a suggestion creates and sends once with the explicit Trip context, then uses the
existing chat-started action to enter the normal Chat workspace and focus its composer.
Trip home retains its list and shared Composer; the Chat retains its Trip association and latest Plan.

## Alternatives considered

Keeping an embedded Chat was the previous decision. It conflicts with the owner's corrected
navigation requirement and duplicates the normal conversation surface.

## Consequences

The embedded Chat state, rendering branches, scroll effect and styles are removed. Error, Retry,
phone navigation and the adjustable chat/map split use the normal workspace. Trip action drawers
continue to open inside Trip home. No catalog or API change is required.
