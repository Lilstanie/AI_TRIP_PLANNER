"use client";
import { WELCOME_MESSAGE, type Message } from "@/lib/workspace";
import type { Notice } from "@/lib/i18n/notice";
import type { TripPlan } from "@trip/shared";
import type { SessionState, Task } from "@/lib/workspace/session";

export { PHONE_VIEWS, type DialogKind, type MobileView } from "@/lib/workspace/layout";

export const seed: Message[] = [
  {
    role: "agent",
    text: WELCOME_MESSAGE,
  },
];
export const STORAGE_FULL: Notice = {
  key: "browserStorageIsUnavailableOr",
};

export type BackgroundTurn = {
  conversationId: string;
  tripId: string;
  task: Task;
  controller: AbortController;
  state: SessionState;
  basePlan: TripPlan | undefined;
};

export const PLAN_CONFLICT: Notice = {
  key: "thePlanChangedWhileThis",
};
const editVersion = (plan: TripPlan | undefined) => plan?.editVersion ?? 0;
export const planChanged = (left: TripPlan | undefined, right: TripPlan | undefined) =>
  editVersion(left) !== editVersion(right);
