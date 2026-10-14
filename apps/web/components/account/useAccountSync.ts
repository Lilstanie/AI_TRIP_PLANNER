"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  emptySynced,
  mergeCatalog,
  pendingChanges,
  acknowledge,
  parseSynced,
  type SyncCheckpoints,
} from "@/lib/account/catalog-sync";
import { SyncPush, SyncResult, type SyncPull } from "@/lib/account/sync";
import type { WorkspaceCatalog } from "@/lib/workspace/catalog";
import { useAccount } from "./AccountProvider";

export type SyncStatus = "local" | "syncing" | "synced" | "offline";

const SYNC_KEY = "trip.sync.v1";
const PUSH_DELAY_MS = 1500;

type StoredSync = { userId: string; synced: SyncCheckpoints };

function readSync(userId: string): SyncCheckpoints {
  try {
    const stored = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "null") as StoredSync | null;

    return stored?.userId === userId ? parseSynced(stored.synced) : emptySynced();
  } catch {
    return emptySynced();
  }
}

function writeSync(userId: string, synced: SyncCheckpoints) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ userId, synced } satisfies StoredSync));
  } catch {
    return;
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
  return SyncResult.parse(await response.json());
}

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
  const synced = useRef<SyncCheckpoints>(emptySynced());
  const queue = useRef(Promise.resolve());
  const identity = useRef(userId);
  identity.current = storageEnabled ? userId : undefined;

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
        const localAtPull = catalogRef.current;
        const before = readSync(userId);
        const {
          catalog: merged,
          push: outgoing,
          synced: checkpoints,
        } = mergeCatalog(localAtPull, remote, before);
        synced.current = checkpoints;
        const result = !isEmpty(outgoing) ? await push(outgoing) : undefined;
        if (!active || identity.current !== userId) return;
        if (result) synced.current = acknowledge(synced.current, result.accepted);
        const serverView: SyncPull = {
          trips: [...remote.trips],
          conversations: [...remote.conversations],
        };
        for (const kind of ["trips", "conversations"] as const)
          for (const item of result?.accepted[kind] ?? [])
            serverView[kind] = [
              ...serverView[kind].filter((record) => record.id !== item.id),
              item,
            ];
        const latest =
          catalogRef.current === localAtPull
            ? merged
            : mergeCatalog(catalogRef.current, serverView, before).catalog;
        catalogRef.current = latest;
        setCatalog(latest);

        writeSync(userId, synced.current);
        setStatus(result && !isEmpty(result.conflicts) ? "offline" : "synced");
        setReady(true);
      } catch {
        if (active) setStatus("offline");
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, storageEnabled, setCatalog]);

  useEffect(() => {
    if (!userId || !ready || !storageEnabled) return;
    const changes = pendingChanges(catalog, synced.current);
    if (isEmpty(changes)) return;
    const timer = window.setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (identity.current !== userId) return;
        const outgoing = pendingChanges(catalogRef.current, synced.current);
        if (isEmpty(outgoing)) return;
        setStatus("syncing");
        try {
          const result = await push(outgoing);
          if (identity.current !== userId) return;
          synced.current = acknowledge(synced.current, result.accepted);
          writeSync(userId, synced.current);
          setStatus(
            !isEmpty(result.conflicts)
              ? "offline"
              : isEmpty(pendingChanges(catalogRef.current, synced.current))
                ? "synced"
                : "syncing",
          );
        } catch {
          if (identity.current === userId) setStatus("offline");
        }
      });
    }, PUSH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [catalog, userId, ready, storageEnabled]);

  return status;
}
