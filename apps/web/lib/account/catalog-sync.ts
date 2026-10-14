import {
  isUntouchedConversation,
  parseCatalog,
  parseConversation,
  parseTrip,
  type ConversationRecord,
  type TripRecord,
  type WorkspaceCatalog,
} from "../workspace/catalog";
import type { SyncPull, SyncPush, SyncedRecord } from "./sync";

export type Checkpoint = { revision: number; contents: string };
export type SyncCheckpoints = {
  trips: Record<string, Checkpoint>;
  conversations: Record<string, Checkpoint>;
};
export const emptySynced = (): SyncCheckpoints => ({ trips: {}, conversations: {} });

type Kind = "trips" | "conversations";
type Record_ = TripRecord | ConversationRecord;
const contents = (record?: Record_) => {
  if (!record) return "";
  const parsed = "conversationIds" in record ? parseTrip(record) : parseConversation(record);
  return JSON.stringify(parsed, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  );
};

function parseRemote(kind: Kind, item: SyncedRecord): Record_ | undefined {
  try {
    const parsed = kind === "trips" ? parseTrip(item.record) : parseConversation(item.record);
    return parsed.id === item.id ? parsed : undefined;
  } catch {
    return undefined;
  }
}

const pushable = (kind: Kind, record: Record_) =>
  kind === "trips" || !isUntouchedConversation(record as ConversationRecord);

const wire = (record: Record_, revision: number): SyncedRecord => ({
  id: record.id,
  updatedAt: record.updatedAt,
  revision,
  record: JSON.parse(JSON.stringify(record)) as Record<string, unknown>,
});

function mergeKind<T extends Record_>(
  kind: Kind,
  local: T[],
  remote: SyncedRecord[],
  synced: Record<string, Checkpoint>,
  now: string,
) {
  const byId = new Map(local.map((record) => [record.id, record]));
  const checkpoints = { ...synced };
  const push: SyncedRecord[] = [];
  const seen = new Set<string>();
  for (const item of remote) {
    seen.add(item.id);
    const mine = byId.get(item.id);
    const base = synced[item.id];
    const parsed = item.deleted ? undefined : parseRemote(kind, item);
    if (!item.deleted && !parsed) continue;
    const clean = base ? contents(mine) === base.contents : !mine;
    const identical = contents(mine) === contents(parsed);
    if (clean || identical) {
      if (parsed) byId.set(item.id, parsed as T);
      else byId.delete(item.id);
      checkpoints[item.id] = { revision: item.revision, contents: contents(parsed) };
    } else if (mine && pushable(kind, mine)) {
      push.push(wire(mine, base?.revision ?? 0));
    } else if (!mine && base) {
      push.push({ id: item.id, updatedAt: now, deleted: true, revision: base.revision });
    }
  }
  for (const record of local) {
    const base = synced[record.id];
    if (!seen.has(record.id) && pushable(kind, record) && contents(record) !== base?.contents)
      push.push(wire(record, base?.revision ?? 0));
  }
  return { records: [...byId.values()], push, checkpoints };
}

function relink(catalog: WorkspaceCatalog): WorkspaceCatalog {
  const tripIds = new Set(catalog.trips.map((trip) => trip.id));
  const conversationIds = new Set(catalog.conversations.map((item) => item.id));
  const conversations = catalog.conversations.map((item) =>
    item.tripId && !tripIds.has(item.tripId) ? { ...item, tripId: undefined } : item,
  ) as ConversationRecord[];
  const trips = catalog.trips.map((trip) => ({
    ...trip,
    conversationIds: trip.conversationIds.filter((id) => conversationIds.has(id)),
  }));
  return {
    ...catalog,
    conversations: conversations.map(({ tripId, ...rest }) =>
      tripId ? { ...rest, tripId } : rest,
    ),
    trips,
    ...(catalog.activeTripId && !tripIds.has(catalog.activeTripId)
      ? { activeTripId: undefined }
      : {}),
    ...(catalog.activeConversationId && !conversationIds.has(catalog.activeConversationId)
      ? { activeConversationId: undefined }
      : {}),
  };
}

export function mergeCatalog(
  local: WorkspaceCatalog,
  remote: SyncPull,
  synced: SyncCheckpoints,
  now = new Date().toISOString(),
): { catalog: WorkspaceCatalog; push: SyncPush; synced: SyncCheckpoints } {
  const trips = mergeKind("trips", local.trips, remote.trips, synced.trips, now);
  const conversations = mergeKind(
    "conversations",
    local.conversations,
    remote.conversations,
    synced.conversations,
    now,
  );
  const merged = relink({ ...local, trips: trips.records, conversations: conversations.records });
  return {
    catalog: parseCatalog(JSON.parse(JSON.stringify(merged))),
    push: { trips: trips.push, conversations: conversations.push },
    synced: { trips: trips.checkpoints, conversations: conversations.checkpoints },
  };
}

export function pendingChanges(
  catalog: WorkspaceCatalog,
  synced: SyncCheckpoints,
  now = new Date().toISOString(),
): SyncPush {
  const diff = (kind: Kind, records: Record_[]) => {
    const present = new Set(records.map((record) => record.id));
    return [
      ...records
        .filter(
          (record) =>
            synced[kind][record.id]?.contents !== contents(record) && pushable(kind, record),
        )
        .map((record) => wire(record, synced[kind][record.id]?.revision ?? 0)),
      ...Object.entries(synced[kind])
        .filter(([id, base]) => !present.has(id) && base.contents !== "")
        .map(([id, base]) => ({ id, updatedAt: now, deleted: true, revision: base.revision })),
    ];
  };
  return {
    trips: diff("trips", catalog.trips),
    conversations: diff("conversations", catalog.conversations),
  };
}

export function acknowledge(synced: SyncCheckpoints, accepted: SyncPull): SyncCheckpoints {
  const next = { trips: { ...synced.trips }, conversations: { ...synced.conversations } };
  for (const kind of ["trips", "conversations"] as const)
    for (const item of accepted[kind]) {
      const record = item.deleted ? undefined : parseRemote(kind, item);
      if (item.deleted || record)
        next[kind][item.id] = { revision: item.revision, contents: contents(record) };
    }
  return next;
}

export function parseSynced(value: unknown): SyncCheckpoints {
  const result = emptySynced();
  if (!value || typeof value !== "object") return result;
  for (const kind of ["trips", "conversations"] as const) {
    const entries = (value as Partial<SyncCheckpoints>)[kind];
    if (!entries || typeof entries !== "object") continue;
    for (const [id, base] of Object.entries(entries))
      if (
        base &&
        Number.isSafeInteger(base.revision) &&
        base.revision >= 0 &&
        typeof base.contents === "string"
      )
        result[kind][id] = base;
  }
  return result;
}
