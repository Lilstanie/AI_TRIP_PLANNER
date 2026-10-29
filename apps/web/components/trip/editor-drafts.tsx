"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type SetStateAction,
} from "react";

export function createEditorDrafts() {
  const values = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  return {
    values,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(key: string, value: unknown) {
      values.set(key, value);
      listeners.forEach((listener) => listener());
    },
  };
}

const DraftContext = createContext<
  { store: ReturnType<typeof createEditorDrafts>; tripId: string } | undefined
>(undefined);

export function EditorDraftProvider({
  store,
  tripId,
  children,
}: {
  store: ReturnType<typeof createEditorDrafts>;
  tripId: string;
  children: ReactNode;
}) {
  return <DraftContext.Provider value={{ store, tripId }}>{children}</DraftContext.Provider>;
}

export function useEditorDraft<T>(name: string, initial: T) {
  const shared = useContext(DraftContext);
  const [local] = useState(createEditorDrafts);
  const store = shared?.store ?? local;
  const key = JSON.stringify([shared?.tripId, name, initial]);
  useEffect(() => {
    if (!store.values.has(key)) store.set(key, initial);
  }, [store, key, initial]);
  const read = () => (store.values.has(key) ? (store.values.get(key) as T) : initial);
  const value = useSyncExternalStore(store.subscribe, read, read);
  const set = (next: SetStateAction<T>) => {
    store.set(key, typeof next === "function" ? (next as (current: T) => T)(read()) : next);
  };
  return [value, set, () => store.set(key, initial)] as const;
}
