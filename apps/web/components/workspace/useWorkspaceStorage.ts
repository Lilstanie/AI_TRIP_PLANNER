"use client";

import type { PendingAsk } from "@/lib/workspace/ask-user";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { TripPlan } from "@trip/shared";
import { CURRENT_KEY, type Draft, type Message, type Snapshot } from "@/lib/workspace";
import {
  CATALOG_KEY,
  serializeCatalog,
  upsertConversationDraft,
  upsertCurrent,
  type RestoredWorkspace,
  type WorkspaceCatalog,
} from "@/lib/workspace/catalog";
import { isCurrentTabPlan, publishTabPlan } from "@/lib/trip/tab-revision";
import { STORAGE_FULL } from "./workspace-helpers";
import type { SessionState } from "@/lib/workspace/session";

type WorkspaceStorageOptions = {
  restored: RestoredWorkspace;
  plan: TripPlan | undefined;
  draft: Draft;
  messages: Message[];
  input: string;
  ask: PendingAsk | undefined;
  previousTotal: number | undefined;
  catalog: WorkspaceCatalog;
  setCatalog: Dispatch<SetStateAction<WorkspaceCatalog>>;
  activeConversation: MutableRefObject<string>;
};

export function useWorkspaceStorage({
  restored,
  plan,
  draft,
  messages,
  input,
  ask,
  previousTotal,
  catalog,
  setCatalog,
  activeConversation,
}: WorkspaceStorageOptions) {
  const [storageError, setStorageError] = useState(restored.storageError);
  const [storageEnabled, setStorageEnabled] = useState(restored.storageEnabled);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "failed">("saved");
  const catalogRef = useRef(catalog);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  const pendingSave = useRef<(() => void) | null>(null);
  const persistedCatalog = useRef<WorkspaceCatalog | undefined>(undefined);
  const persistCatalog = useCallback((next: WorkspaceCatalog) => {
    if (persistedCatalog.current === next) return;
    localStorage.setItem(CATALOG_KEY, serializeCatalog(next));
    persistedCatalog.current = next;
  }, []);
  useEffect(() => {
    if (!storageEnabled) return;
    const conversationId = activeConversation.current;
    setSaveState("saving");
    const persist = () => {
      pendingSave.current = null;
      if (plan && !isCurrentTabPlan(plan)) return;
      try {
        let nextCatalog: WorkspaceCatalog;
        if (!plan) {
          nextCatalog = upsertConversationDraft(catalogRef.current, {
            id: conversationId,
            messages,
            input,
            ask,
            draft,
          });
        } else {
          const current = {
            version: 4,
            id: conversationId.replace(/^conversation:/, ""),
            savedAt: new Date().toISOString(),
            plan,
            draft,
            messages,
            input,
            ask,
            previousTotal,
          } satisfies Snapshot;
          const saved = catalogRef.current.conversations.find(
            (item) => item.id === conversationId,
          )?.snapshot;
          const unchanged =
            saved !== undefined &&
            JSON.stringify([saved.plan, saved.draft, saved.messages, saved.input, saved.ask]) ===
              JSON.stringify([plan, draft, messages, input, ask]) &&
            saved.previousTotal === previousTotal &&
            JSON.stringify(
              catalogRef.current.trips.find((item) => item.id === `trip:${plan.tripId}`)?.snapshot
                .plan,
            ) === JSON.stringify(plan) &&
            catalogRef.current.activeConversationId === conversationId;
          if (unchanged) {
            setSaveState("saved");
            return;
          }
          nextCatalog = upsertCurrent(catalogRef.current, current, messages);
          localStorage.setItem(CURRENT_KEY, JSON.stringify(current));
        }
        persistCatalog(nextCatalog);
        catalogRef.current = nextCatalog;
        setCatalog(nextCatalog);
        setSaveState("saved");
      } catch {
        setStorageEnabled(false);
        setSaveState("failed");
        setStorageError(STORAGE_FULL);
      }
    };
    pendingSave.current = persist;
    const timer = window.setTimeout(persist, 350);
    return () => {
      window.clearTimeout(timer);
      if (pendingSave.current === persist) pendingSave.current = null;
    };
  }, [
    storageEnabled,
    plan,
    draft,
    messages,
    input,
    ask,
    previousTotal,
    activeConversation,
    setCatalog,
    persistCatalog,
  ]);

  useEffect(() => {
    if (!storageEnabled) return;
    try {
      if (plan && !isCurrentTabPlan(plan)) return;
      persistCatalog(catalog);
    } catch {
      setSaveState("failed");
      setStorageEnabled(false);
      setStorageError(STORAGE_FULL);
    }
  }, [catalog, storageEnabled, plan, persistCatalog]);

  function flushSave() {
    pendingSave.current?.();
    return catalogRef.current;
  }

  function saveBackground(id: string, state: SessionState, applyPlan = true) {
    const current = flushSave();
    const conversation = current.conversations.find((item) => item.id === id);
    if (!conversation) return;
    if (state.plan && applyPlan) publishTabPlan(state.plan);
    const snapshot =
      current.trips.find((trip) => trip.id === conversation.tripId)?.snapshot ??
      conversation.snapshot;
    let next =
      state.plan && applyPlan
        ? upsertCurrent(current, {
            version: 4,
            id: id.replace(/^conversation:/, ""),
            savedAt: new Date().toISOString(),
            plan: state.plan,
            draft: state.draft,
            messages: state.messages,
            input: state.input,
            ask: state.ask,
            previousTotal: state.previousTotal,
          })
        : state.plan
          ? {
              ...current,
              conversations: current.conversations.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      updatedAt: new Date().toISOString(),
                      messages: state.messages,
                      input: state.input,
                      ask: state.ask,
                      draft: snapshot?.draft ?? state.draft,
                      ...(snapshot
                        ? {
                            snapshot: {
                              ...snapshot,
                              id: id.replace(/^conversation:/, ""),
                              messages: state.messages,
                              input: state.input,
                              ask: state.ask,
                            },
                          }
                        : {}),
                    }
                  : item,
              ),
            }
          : upsertConversationDraft(current, {
              id,
              messages: state.messages,
              input: state.input,
              ask: state.ask,
              draft: state.draft,
            });
    next = {
      ...next,
      activeConversationId: current.activeConversationId,
      activeTripId: current.activeTripId,
    };
    catalogRef.current = next;
    setCatalog(next);
    if (storageEnabled) {
      try {
        persistCatalog(next);
      } catch {
        setStorageEnabled(false);
        setSaveState("failed");
        setStorageError(STORAGE_FULL);
      }
    }
  }

  return {
    storageError,
    storageEnabled,
    saveState,
    setStorageError,
    setStorageEnabled,
    flushSave,
    saveBackground,
  };
}
