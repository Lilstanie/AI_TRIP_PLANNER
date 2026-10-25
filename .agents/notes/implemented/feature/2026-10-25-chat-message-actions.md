# Agent Note: the map waits for a plan, and messages get copy and edit-and-resend

Status: implemented
Owner: Joey, thread "Polish chat layout and message actions"

## Problem

A new chat showed an empty map beside it, the Think row and chat tabs rendered as pills, and the
chat text had no copy or edit control.

## Decision

- **Cause of the pills.** The global `button:not(...)` rule in `forms.css` styles every unlisted button as a pill and outranks single-class rules. The Think toggle, the tool-call summary and the chat tabs were never listed. They are now excluded there.
- **Map on demand.** On desktop the shell carries `data-map="hidden"` until a plan exists, then the grid column animates from `0` to the split. Tablet and phone keep their view switch.
- **Copy and edit.** Copy sits under every message. Edit-and-resend truncates the log at that message (`rewound` session event) and sends the new text; the plan is not rolled back. Messages with attachments have no edit.
- **Tabs and team button.** The Conversation and Trajectory tabs are underlined text; the team button shows avatars only, its name kept for assistive technology.

## Alternatives considered

- Rolling the plan back on resend: rejected, the plan history keeps no per-message snapshots.
- Hiding the map with `display: none`: rejected, it cannot slide.

## Consequences

A resent message re-plans from the current plan, so earlier plan edits survive it.
