"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { CloseIcon, FileIcon } from "../ui/icons";
import { fileExtension, formatBytes } from "@/lib/chat/attachments";

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

  thumbnail?: string;

  bytes?: number;

  truncated?: boolean;

  onRemove?: () => void;
}) {
  const { t } = useLocale();
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
          aria-label={t("Remove {v0}", { v0: name })}

          onMouseDown={(event) => event.preventDefault()}
          onClick={onRemove}
        >
          <CloseIcon />
        </button>
      )}
    </li>
  );
}
