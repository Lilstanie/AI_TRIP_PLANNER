"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  emptySynced,
  mergeCatalog,
  pendingChanges,
  syncedTimes,
  type SyncedTimes,
} from "@/lib/account/catalog-sync";
import { SyncPush, type SyncPull } from "@/lib/account/sync";
import type { WorkspaceCatalog } from "@/lib/workspace/catalog";
import { useAccount } from "./AccountProvider";

export type SyncStatus = "local" | "syncing" | "synced" | "offline";

const SYNC_KEY = "trip.sync.v1";
const PUSH_DELAY_MS = 1500;

type StoredSync = { userId: string; synced: SyncedTimes };

function readSync(userId: string): SyncedTimes {
  try {
    const stored = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "null") as StoredSync | null;
    // Another user's sync record says nothing about this user's account.
    return stored?.userId === userId ? stored.synced : emptySynced();
  } catch {
    return emptySynced();
  }
}

function writeSync(userId: string, synced: SyncedTimes) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ userId, synced } satisfies StoredSync));
  } catch {
    // Without it the next sign-in merges from scratch, which is safe, just slower.
  }
}

const isEmpty = (push: SyncPush) => !push.trips.length && !push.conversations.length;

async function push(changes: SyncPush) {
  const response = await fetch("/api/account/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!response.ok) throw new Error(`Sync failed (${response.status}).`);
}

/**
 * Keeps the signed-in traveller's trips and chats in their account. The browser catalog stays the
 * working store: on sign-in it is merged with the account (lib/account/catalog-sync.ts), and after
 * that each change is pushed a moment later. A failed push leaves the change pending and it goes
 * with the next one; nothing local is discarded because the server could not be reached.
 */
export function useAccountSync({
  catalog,
  setCatalog,
  storageEnabled,
}: {
  catalog: WorkspaceCatalog;
  setCatalog: Dispatch<SetStateAction<WorkspaceCatalog>>;
  storageEnabled: boolean;
}): SyncStatus {
  const account = useAccount();
  const userId = account.status === "signed-in" ? account.userId : undefined;
  const [status, setStatus] = useState<SyncStatus>("local");
  const [ready, setReady] = useState(false);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const synced = useRef<SyncedTimes>(emptySynced());

  // Sign-in (or reopening signed in): pull the account and merge it with this browser.
  useEffect(() => {
    setReady(false);
    if (!userId || !storageEnabled) {
      setStatus("local");
      return;
    }
    let active = true;
    setStatus("syncing");
    void (async () => {
      try {
        const response = await fetch("/api/account/sync");
        if (!response.ok) throw new Error(String(response.status));
        const remote = SyncPush.parse(await response.json()) as SyncPull;
        if (!active) return;
        const { catalog: merged, push: outgoing } = mergeCatalog(
          catalogRef.current,
          remote,
          readSync(userId),
        );
        if (!isEmpty(outgoing)) await push(outgoing);
        if (!active) return;
        catalogRef.current = merged;
        setCatalog(merged);
        synced.current = syncedTimes(merged);
        writeSync(userId, synced.current);
        setStatus("synced");
        setReady(true);
      } catch {
        if (active) setStatus("offline");
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, storageEnabled, setCatalog]);

  // After the first merge: push what changed, a moment after it changed.
  useEffect(() => {
    if (!userId || !ready) return;
    const changes = pendingChanges(catalog, synced.current);
    if (isEmpty(changes)) return;
    const timer = window.setTimeout(() => {
      setStatus("syncing");
      const snapshot = catalogRef.current;
      void push(pendingChanges(snapshot, synced.current))
        .then(() => {
          synced.current = syncedTimes(snapshot);
          writeSync(userId, synced.current);
          setStatus("synced");
        })
        .catch(() => setStatus("offline"));
    }, PUSH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [catalog, userId, ready]);

  return status;
}
