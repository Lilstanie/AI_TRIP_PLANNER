# Agent Note: Trip home sends the first message

Status: implemented
Owner: spec #788, ticket #792, TP-152

Partly supersedes the separate Start chat step and destination-only titles in
[Trip home chats](2026-10-28-trip-home-chats.md) and the empty-chat behavior in
[Trip home page](2026-10-28-trip-home-page.md). The
[in-place action rail](2026-10-29-trip-home-actions.md) continues to own the page and drawer layout.

## Problem

Starting a Trip-home Chat previously copied input into another composer without sending it.
An empty click created a Chat, and same-day discussions had indistinguishable generated titles.
Sending immediately through the prior render's transport could target the wrong Trip or Plan.

## Decision

- `sendTripChat` prepares the request from the explicit current Trip snapshot before opening the new
  conversation. It then starts the existing transport once under that conversation's ownership.
  Preparation checks existing planning concurrency and edited-Plan confirmation before creating a Chat.
- Empty input, focus, typing, clearing and IME confirmation create nothing. Enter sends and
  Shift+Enter inserts a newline. The home composer clears its unsent draft when its Trip changes.
- Home Send disables only while this Trip already has a writer (`writingTripIds`) or an edit is
  pending, so a pending generation in another Trip leaves this Trip's first send enabled.
- After first send, keyboard focus moves into the embedded Chat composer. On phones the new Chat is
  scrolled to the top of the Trip-home scroller first, so its message and focused composer are
  visible. The shared composer stays `readOnly` while busy so focus can land there during generation
  without accepting new input.
- The embedded Chat renders the existing error and Retry controls. Failure retains one Chat and
  one user message; Retry uses the same conversation and request.
- Automatic Chat titles use the first user message, collapse whitespace and truncate at 72 Unicode
  code points. Manual names retain precedence. Rows show the localized date and a chevron; the
  heading shows the linked Chat count.
- The main column scrolls above its bottom composer. Ideas counts, suggestions and drawers continue
  to use the existing `tripIdeas` selector, including unscheduled restaurant suggestions. Auxiliary
  dismissal storage remains independent from the Trip catalog.

## Alternatives considered

- Keep Start chat and require another send: preserves the duplicate action that #792 removes.
- Call the existing render's `send` immediately after switching state: that closure still holds the
  previous conversation's Plan and draft. Explicit request preparation avoids waiting for a render
  or adding a second effect-driven send path.
- Add a separate request runner for home: duplicates existing generation ownership, retry and
  concurrency rules.

## Consequences

The catalog format and API contract stay unchanged. Opening old Chats still uses the latest Trip
Plan. Navigation and generation ownership remain governed by the existing background-turn registry.
`trip-home-send` is a production fixture browser journey with a failure inventory, controlled NDJSON,
blocked external requests, screenshots and a JSON summary. Browser viewport checks do not establish
live-provider, production authentication or physical keyboard behavior.
