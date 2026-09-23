"use client";
import { CloseIcon, FileIcon } from "../ui/icons";
import { fileExtension, formatBytes } from "@/lib/chat/attachments";

/**
 * One attached file, drawn as DeepSeek Harness draws its file card
 * (ui-attachment `FileCard`, ui-chat `MessageItem` .fileCard): a square leading
 * slot, the file name on one line and its type and size on a quieter second
 * line, with the remove control in the card's top corner.
 *
 * DSH uses two shapes — a bare 64px thumbnail for an image and a 240px card for
 * a file. One shape serves both here: this composer sits in a chat column
 * narrow enough that an unlabelled square would be the only thing a traveller
 * could identify a photo by, and a pasted screenshot has no name to hover for.
 * So an image puts its thumbnail in the same leading slot the glyph uses.
 *
 * The same chip renders in the composer (with `onRemove`) and under a sent
 * message (without it), so a file looks the same before and after it was sent.
 */
export function AttachmentChip({
  name,
  kind,
  thumbnail,
  bytes,
  truncated,
  onRemove,
}: {
  name: string;
  kind: "image" | "text";
  /** Small inline preview; images that could be re-encoded have one. */
  thumbnail?: string;
  /** Size of what is sent, when known. */
  bytes?: number;
  /** Set when only the head of a text file was taken. */
  truncated?: boolean;
  /** Present in the composer; absent once the message has been sent. */
  onRemove?: () => void;
}) {
  const meta = [
    fileExtension(name),
    bytes === undefined ? "" : formatBytes(bytes),
    truncated ? "truncated" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="attachment-chip" data-kind={kind} title={name}>
      {kind === "image" && thumbnail ? (
        // Empty alt: the file name sits beside it as real text, so a screen
        // reader that also read the image would say the name twice.
        // next/image is for URLs a loader can fetch and resize; this is an
        // inline data URL a few hundred pixels wide, already produced at the
        // size it is drawn at, and there is nothing for a loader to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="attachment-chip__thumb" src={thumbnail} alt="" />
      ) : (
        <span className="attachment-chip__glyph" aria-hidden="true">
          <FileIcon />
        </span>
      )}
      <span className="attachment-chip__text">
        <span className="attachment-chip__name">{name}</span>
        <span className="attachment-chip__meta">{meta}</span>
      </span>
      {onRemove && (
        <button
          type="button"
          className="attachment-chip__remove"
          aria-label={`Remove ${name}`}
          // Removing a file must not pull focus out of the draft.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRemove}
        >
          <CloseIcon />
        </button>
      )}
    </li>
  );
}
