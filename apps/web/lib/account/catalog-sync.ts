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

/**
 * How a browser's catalog and an account's records become one. Pure functions, so the rules live
 * in one readable place:
 *
 * - Per record, the newer `updatedAt` wins whole; there is no field merge.
 * - A deletion is a tombstone with its own time. A tombstone newer than a local edit removes the
 *   record here; a local edit newer than the tombstone restores it on the account.
 * - `synced` remembers each record's `updatedAt` at the last successful sync. A record that was
 *   synced and is now missing locally was deleted here, so it becomes a tombstone rather than
 *   being pulled back.
 * - Untouched blank chats never leave the browser.
 * - Remote records pass the catalog's own parsers; one that fails is skipped, never trusted.
 */

export type SyncedTimes = { trips: Record<string, string>; conversations: Record<string, string> };
export const emptySynced = (): SyncedTimes => ({ trips: {}, conversations: {} });

type Kind = "trips" | "conversations";
type Record_ = TripRecord | ConversationRecord;

const newer = (a: string, b: string) => Date.parse(a) > Date.parse(b);

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

const wire = (record: Record_): SyncedRecord => ({
  id: record.id,
  updatedAt: record.updatedAt,
  record: JSON.parse(JSON.stringify(record)) as Record<string, unknown>,
});

function mergeKind<T extends Record_>(
  kind: Kind,
  local: T[],
  remote: SyncedRecord[],
  synced: Record<string, string>,
  now: string,
) {
  const byId = new Map(local.map((record) => [record.id, record]));
  const push: SyncedRecord[] = [];
  const seen = new Set<string>();
  for (const item of remote) {
    seen.add(item.id);
    const mine = byId.get(item.id);
    if (item.deleted) {
      if (mine && newer(mine.updatedAt, item.updatedAt)) push.push(wire(mine));
      else byId.delete(item.id);
      continue;
    }
    if (!mine) {
      // Synced before and gone now: deleted in this browser since the last sync.
      if (synced[item.id]) push.push({ id: item.id, updatedAt: now, deleted: true });
      else {
        const parsed = parseRemote(kind, item);
        if (parsed) byId.set(item.id, parsed as T);
      }
      continue;
    }
    if (newer(item.updatedAt, mine.updatedAt)) {
      const parsed = parseRemote(kind, item);
      if (parsed) byId.set(item.id, parsed as T);
    } else if (newer(mine.updatedAt, item.updatedAt) && pushable(kind, mine)) push.push(wire(mine));
  }
  for (const record of local)
    if (!seen.has(record.id) && pushable(kind, record)) push.push(wire(record));
  return { records: [...byId.values()], push };
}

/** Keep trip and chat links consistent after records arrived or left from either side. */
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
    conversations: conversations.map(({ tripId, ...rest }) => (tripId ? { ...rest, tripId } : rest)),
    trips,
    ...(catalog.activeTripId && !tripIds.has(catalog.activeTripId) ? { activeTripId: undefined } : {}),
    ...(catalog.activeConversationId && !conversationIds.has(catalog.activeConversationId)
      ? { activeConversationId: undefined }
      : {}),
  };
}

/** The first sync after signing in (or reopening): merge both sides, and what to send back. */
export function mergeCatalog(
  local: WorkspaceCatalog,
  remote: SyncPull,
  synced: SyncedTimes,
  now = new Date().toISOString(),
): { catalog: WorkspaceCatalog; push: SyncPush } {
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
    // Re-validated as a whole: links, active ids and every record.
    catalog: parseCatalog(JSON.parse(JSON.stringify(merged))),
    push: { trips: trips.push, conversations: conversations.push },
  };
}

/** What changed in this browser since the last sync: edits, new records and deletions. */
export function pendingChanges(
  catalog: WorkspaceCatalog,
  synced: SyncedTimes,
  now = new Date().toISOString(),
): SyncPush {
  const diff = (kind: Kind, records: Record_[]) => {
    const present = new Set(records.map((record) => record.id));
    return [
      ...records.filter(
        (record) => synced[kind][record.id] !== record.updatedAt && pushable(kind, record),
      ).map(wire),
      ...Object.keys(synced[kind])
        .filter((id) => !present.has(id))
        .map((id) => ({ id, updatedAt: now, deleted: true })),
    ];
  };
  return { trips: diff("trips", catalog.trips), conversations: diff("conversations", catalog.conversations) };
}

/** The synced times once `catalog` matches the account. */
export function syncedTimes(catalog: WorkspaceCatalog): SyncedTimes {
  const times = (records: Record_[], kind: Kind) =>
    Object.fromEntries(
      records.filter((record) => pushable(kind, record)).map((record) => [record.id, record.updatedAt]),
    );
  return { trips: times(catalog.trips, "trips"), conversations: times(catalog.conversations, "conversations") };
}
