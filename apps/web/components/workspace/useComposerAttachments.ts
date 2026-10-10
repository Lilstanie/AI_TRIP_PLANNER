"use client";
import type { Notice } from "@/lib/i18n/notice";
import { useCallback, useRef, useState } from "react";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "@trip/shared";
import {
  prepareAttachments,
  type ImageRenderer,
  type PreparedAttachment,
} from "@/lib/chat/attachments";
import type { MessageAttachment } from "@/lib/workspace";

export type ComposerAttachments = {
  attachments: PreparedAttachment[];

  addFiles: (files: File[]) => void;
  removeAttachment: (id: string) => void;

  clearAttachments: () => void;

  canAttach: boolean;

  notices: Notice[];
};

export function useComposerAttachments({ render }: { render?: ImageRenderer } = {}) {
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);

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
          setNotices(
            rejections.map(({ name, reason }) => ({
              key: "{name} wasn't attached — {reason}.",
              params: { name, reason },
            })),
          );
        })
        .catch(() => {
          setAttachments((current) => {
            held.current = current.length;
            spent.current = payloadOf(current);
            return current;
          });
          setNotices([{ key: "Those files couldn't be read. Please try again." }]);
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
    setNotices([]);
  }, []);

  const clearAttachments = useCallback(() => {
    held.current = 0;
    spent.current = 0;
    setAttachments([]);
    setNotices([]);
  }, []);

  const full = attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE;
  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    canAttach: !full,
    notices:
      notices.length || !full
        ? notices
        : [
            {
              key: "You can attach {count} files to one message.",
              params: { count: MAX_ATTACHMENTS_PER_MESSAGE },
            },
          ],
  } satisfies ComposerAttachments;
}

const payloadOf = (attachments: PreparedAttachment[]) =>
  attachments.reduce((total, attachment) => total + attachment.data.length, 0);

export function storedAttachments(attachments: PreparedAttachment[]): MessageAttachment[] {
  return attachments.map(({ name, mediaType, kind, thumbnail, bytes }) => ({
    name,
    mediaType,
    kind,
    ...(thumbnail ? { thumbnail } : {}),
    bytes,
  }));
}
