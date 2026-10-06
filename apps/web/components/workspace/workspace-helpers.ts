"use client";
import { WELCOME_MESSAGE, type Message } from "@/lib/workspace";
import type { Notice } from "@/lib/i18n/notice";

export { PHONE_VIEWS, type DialogKind, type MobileView } from "@/lib/workspace/layout";

export const seed: Message[] = [
  {
    role: "agent",
    text: WELCOME_MESSAGE,
  },
];
export const STORAGE_FULL: Notice = {
  key: "Browser storage is unavailable or full. Your current plan is still in this tab. Retry after freeing space.",
};
