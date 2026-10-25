---
date: 2026-10-25
author: Claude
branch: feature/chat-layout-message-actions
pr: none
area: apps/web
contract-impact: none
---

# Plain Think rows, quiet tabs, map on demand, copy and edit on messages

## What changed

- `forms.css` stops pill-styling the Think toggle, summary and chat tabs; tabs are underlined text.
- Map hidden until a plan exists (`WorkspaceView`, `workspace-layout.css`), slides in over 420 ms.
- `MessageItem`: copy button on all messages, edit and resend on traveller messages; `rewound` event in `session.ts`.
- Team button shows avatars only.
- New E2E `chat-message-actions` with its failure inventory; docs and Agent Note updated.

## Validation

- `chat-message-actions` E2E: red on origin/main (1/7), green after (14/14).
- `team-panel-desktop` and `team-panel-phone` E2Es ran; `tsc`, `pnpm lint` and Prettier pass.
- `thinking-disclosure` E2E fails the same way on origin/main in this sandbox.

## Notes for the next person

Resend does not roll the plan back. Edit is hidden on messages with attachments.
