"use client";
import { useCallback, useRef, useState } from "react";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "@trip/shared";
import {
  prepareAttachments,
  type ImageRenderer,
  type PreparedAttachment,
} from "@/lib/chat/attachments";
import type { MessageAttachment } from "@/lib/workspace";

export type ComposerAttachments = {
  /** Files held for the next message. */
  attachments: PreparedAttachment[];
  /** Takes files from the picker, a drop or a paste and prepares them. */
  addFiles: (files: File[]) => void;
  removeAttachment: (id: string) => void;
  /** Drops everything held — after a send, or when the conversation changes. */
  clearAttachments: () => void;
  /** False at the per-message limit; `notice` then says so. */
  canAttach: boolean;
  /** One line for the composer: what was refused, or that the limit is reached. */
  notice: string;
};

/**
 * The composer's held attachments. Preparation (downscaling, truncation, the
 * type and size rules) lives in `lib/chat/attachments`; this hook owns only the
 * held list, the inline explanation, and the limit the plus control is disabled
 * by.
 *
 * `render` is injected in tests, where jsdom has no canvas.
 */
export function useComposerAttachments({ render }: { render?: ImageRenderer } = {}) {
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [notice, setNotice] = useState("");
  // The count and payload at the moment a pick starts. Preparation is
  // asynchronous, so a second pick that begins before the first finishes must
  // still see what the first one is adding, or a limit could be passed.
  const held = useRef(0);
  const spent = useRef(0);

  const addFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      const pending = held.current;
      held.current = Math.min(MAX_ATTACHMENTS_PER_MESSAGE, pending + files.length);
      void prepareAttachments(files, {
        held: pending,
        spent: spent.current,
        ...(render ? { render } : {}),
      })
        .then(({ attachments: prepared, rejections }) => {
          setAttachments((current) => {
            const next = [...current, ...prepared].slice(0, MAX_ATTACHMENTS_PER_MESSAGE);
            held.current = next.length;
            spent.current = payloadOf(next);
            return next;
          });
          setNotice(
            rejections.length
              ? rejections.map(({ name, reason }) => `${name} wasn't attached — ${reason}.`).join(" ")
              : "",
          );
        })
        .catch(() => {
          // Nothing was added, so the reserved count and payload go back to
          // what is actually held. Read through the setter rather than from the
          // closure: this pick may not be the only one in flight.
          setAttachments((current) => {
            held.current = current.length;
            spent.current = payloadOf(current);
            return current;
          });
          setNotice("Those files couldn't be read. Please try again.");
        });
    },
    [render],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => {
      const next = current.filter((attachment) => attachment.id !== id);
      held.current = next.length;
      spent.current = payloadOf(next);
      return next;
    });
    setNotice("");
  }, []);

  const clearAttachments = useCallback(() => {
    held.current = 0;
    spent.current = 0;
    setAttachments([]);
    setNotice("");
  }, []);

  const full = attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE;
  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    canAttach: !full,
    notice:
      notice ||
      (full ? `You can attach ${MAX_ATTACHMENTS_PER_MESSAGE} files to one message.` : ""),
  } satisfies ComposerAttachments;
}

/** Payload characters the held attachments account for in the request body. */
const payloadOf = (attachments: PreparedAttachment[]) =>
  attachments.reduce((total, attachment) => total + attachment.data.length, 0);

/**
 * What a sent message keeps: identity and a small thumbnail, never the base64
 * payload. The workspace is persisted in browser storage, and the full images
 * would exhaust that budget within a handful of turns.
 */
export function storedAttachments(attachments: PreparedAttachment[]): MessageAttachment[] {
  return attachments.map(({ name, mediaType, kind, thumbnail, bytes }) => ({
    name,
    mediaType,
    kind,
    ...(thumbnail ? { thumbnail } : {}),
    bytes,
  }));
}
