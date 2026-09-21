"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { TripPlan } from "@trip/shared";
import {
  CURRENT_KEY,
  SAVED_KEY,
  parseSaved,
  type Draft,
  type Message,
  type Snapshot,
} from "@/lib/workspace";
import {
  CATALOG_KEY,
  serializeCatalog,
  upsertConversationDraft,
  upsertCurrent,
  type RestoredWorkspace,
  type WorkspaceCatalog,
} from "@/lib/workspace/catalog";
import { STORAGE_FULL } from "./workspace-helpers";

type WorkspaceStorageOptions = {
  restored: RestoredWorkspace;
  plan: TripPlan | undefined;
  draft: Draft;
  messages: Message[];
  input: string;
  previousTotal: number | undefined;
  catalog: WorkspaceCatalog;
  setCatalog: Dispatch<SetStateAction<WorkspaceCatalog>>;
  activeConversation: MutableRefObject<string>;
  setNotice: Dispatch<SetStateAction<string>>;
};

export function useWorkspaceStorage({
  restored,
  plan,
  draft,
  messages,
  input,
  previousTotal,
  catalog,
  setCatalog,
  activeConversation,
  setNotice,
}: WorkspaceStorageOptions) {
  const [saved, setSaved] = useState<Snapshot[]>(restored.saved);
  const [storageError, setStorageError] = useState(restored.storageError ?? "");
  const [storageEnabled, setStorageEnabled] = useState(restored.storageEnabled);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "failed">("saved");
  const catalogRef = useRef(catalog);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  // Debounced autosave of the active conversation (and its trip, once one exists).
  const pendingSave = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!storageEnabled) return;
    const conversationId = activeConversation.current;
    setSaveState("saving");
    const persist = () => {
      pendingSave.current = null;
      try {
        let nextCatalog: WorkspaceCatalog;
        if (!plan) {
          nextCatalog = upsertConversationDraft(catalogRef.current, {
            id: conversationId,
            messages,
            input,
            draft,
          });
        } else {
          const current = {
            version: 3,
            id: conversationId.replace(/^conversation:/, ""),
            savedAt: new Date().toISOString(),
            plan,
            draft,
            messages,
            input,
            previousTotal,
          } satisfies Snapshot;
          nextCatalog = upsertCurrent(catalogRef.current, current, messages);
          localStorage.setItem(CURRENT_KEY, JSON.stringify(current));
        }
        localStorage.setItem(CATALOG_KEY, serializeCatalog(nextCatalog));
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
  }, [storageEnabled, plan, draft, messages, input, previousTotal, activeConversation, setCatalog]);

  useEffect(() => {
    if (!storageEnabled) return;
    try {
      localStorage.setItem(CATALOG_KEY, serializeCatalog(catalog));
    } catch {
      setSaveState("failed");
      setStorageEnabled(false);
      setStorageError(STORAGE_FULL);
    }
  }, [catalog, storageEnabled]);

  function snapshot(current: TripPlan): Snapshot {
    return {
      version: 3,
      id: activeConversation.current.replace(/^conversation:/, ""),
      savedAt: new Date().toISOString(),
      plan: current,
      draft,
      messages,
      input,
      previousTotal,
    };
  }
  function save() {
    if (!plan) {
      setNotice("Add trip details before saving a trip.");
      return;
    }
    try {
      const current = parseSaved(localStorage.getItem(SAVED_KEY));
      const next = [{ ...snapshot(plan), id: crypto.randomUUID() }, ...current];
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setSaved(next);
      setNotice("Saved a copy of this trip in this browser.");
      setStorageError("");
    } catch {
      setStorageError(
        "Could not save this trip. Storage may be full or the saved list unreadable. Existing data was kept.",
      );
    }
  }
  function loadSaved() {
    try {
      setSaved(parseSaved(localStorage.getItem(SAVED_KEY)));
      setStorageError("");
    } catch {
      setStorageError("Saved trips are still unreadable. Existing data was kept.");
    }
  }

  function flushSave() {
    pendingSave.current?.();
  }

  return {
    saved,
    storageError,
    storageEnabled,
    saveState,
    setStorageError,
    setStorageEnabled,
    flushSave,
    save,
    loadSaved,
  };
}
