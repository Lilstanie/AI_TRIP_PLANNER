"use client";
import { WELCOME_MESSAGE, type Message } from "@/lib/workspace";

export { PHONE_VIEWS, type DialogKind, type MobileView } from "@/lib/workspace/layout";

export const seed: Message[] = [
  {
    role: "agent",
    text: WELCOME_MESSAGE,
  },
];
export const STORAGE_FULL =
  "Browser storage is unavailable or full. Your current plan is still in this tab. Retry after freeing space.";
