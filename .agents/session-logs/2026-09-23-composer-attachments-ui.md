---
date: 2026-09-23
author: Claude Opus 5
branch: feature/thinking-ui
pr: none
area: apps/web, packages/shared, packages/orchestrator
contract-impact: packages/shared
---

# Send real attachments from the composer, DSH-style

## What changed

- New `apps/web/lib/chat/attachments.ts`: classification by media type (extension when the browser
  declares none), canvas downscale/re-encode of images (1024px longest side, quality 0.8, PNG kept
  while the picture has transparency and the payload allows it) behind an injectable renderer,
  byte-accurate text truncation with an in-text marker, the per-message count limit, and a shared
  ~4 MB payload budget so four images cannot produce a body the platform 413s before the handler
  runs. Limits are imported from `@trip/shared`, never restated.
- New `components/chat/AttachmentChip.tsx` (one chip shape for the composer and the sent message),
  `components/workspace/useComposerAttachments.ts` (held files, inline refusal line, limit) and
  `app/styles/attachments.css`; `ui/icons.tsx` gains `FileIcon`.
- `components/chat/Composer.tsx`: chips above the draft, drag-and-drop on the card, paste (an image
  on the clipboard is the common case), the plus control disabled at the limit with an inline line
  saying why, and the file input visually hidden instead of `hidden` so it stays in the a11y tree.
  `ChatPanel.tsx` passes them through; `forms.css` exempts the chip's remove button from the 36px
  button floor.
- Send path: `useWorkspaceTransport.send` puts the files on `ChatRequest.attachments`, records
  thumbnails on the message and clears the composer; `useWorkspaceController` clears them when the
  conversation changes. `WorkspaceView.tsx` loses the "Attachments aren't supported yet" notice.
- Storage: `Message.attachments` keeps only name, media type, kind, size and a ≤256px thumbnail,
  validated on load by `withValidAttachments` (a non-`data:image/` thumbnail is dropped) in both
  `workspace.ts` and `catalog.ts`, the same posture as `withValidActivity`.
- Contract and server: `packages/shared/src/chat.ts` adds `Attachment`, the limit constants and
  `ChatRequest.attachments`; `message` is now empty-able when a turn carries attachments, so a
  picture can be the whole message. `packages/orchestrator/src/chat.ts` sends images to the
  coordinator as `image_url` content blocks and inlines a text file under a named delimiter; the API
  route answers an oversized or unsupported attachment with a 400 naming the reason.
- Docs: the composer and attachment sections of `docs/design/dsh-thinking-ui.md`, plus `docs/api.md`
  and `docs/architecture.md` for the wire shape and its limits.

## Why

The full base64 image is never stored: the workspace snapshot lives in browser storage and a couple
of 1.5 MB payloads would exhaust it, so the transcript keeps a thumbnail and the payload leaves with
the request only. Images are re-encoded rather than forwarded because a phone photo is several
megabytes and every attachment travels inline in the JSON body.

## Validation

- `pnpm --filter @trip/web typecheck` — clean.
- `pnpm --filter @trip/web test` — 29 files, 279 tests passed (new: `tests/lib/chat/attachments.test.ts`,
  `tests/components/chat/ComposerAttachments.test.tsx`, plus cases in `MessageItem.test.tsx` and
  `tests/lib/workspace/workspace.test.ts`).
- `pnpm --filter @trip/web lint` — no warnings or errors. `pnpm verify:docs` — valid.
- `pnpm -r test` — 657 passed. Live provider check: a generated PNG reading "KYOTO" was attached in
  the browser and `deepseek-v4-flash` answered "KYOTO", so an image genuinely reaches the model.
  A 1.85 MB PNG plus a `.md` became two chips (12 KB after re-encoding); the chips stay on the sent
  message after a reload; the fifth file is refused with an inline line and the plus control
  disables; checked at 375px.

## Notes for the next person

The platform rejects a request body over 4.5 MB before the handler runs, which is why the composer
spends a shared ~4 MB budget across a message's files rather than trusting the per-file cap alone.
Only the coordinator sees attachments; a specialist never does.
