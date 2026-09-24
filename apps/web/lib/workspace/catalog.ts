import type { TripPlan } from "@trip/shared";
import {
  CURRENT_KEY,
  blankDraft,
  isDraft,
  parseSnapshot,
  type Draft,
  type Message,
  withValidActivity,
  withValidAttachments,
  type Snapshot,
} from "./workspace";

/** Storage key for the multi-chat/multi-trip workspace catalog. */
export const CATALOG_KEY = "trip-workspace-catalog-v3";

export type TripStatus = "draft" | "needs_review";
export type WorkspaceView = "chat" | "map" | "trip";

export type ConversationRecord = {
  id: string;
  title: string;
  updatedAt: string;
  tripId?: string;
  messages: Message[];
  input: string;
  renamed?: boolean;
  snapshot?: Snapshot;
  /** Unfinished preferences of a conversation that has not produced a trip yet. */
  draft?: Draft;
};

export type TripRecord = {
  id: string;
  title: string;
  updatedAt: string;
  status: TripStatus;
  conversationIds: string[];
  snapshot: Snapshot;
};

export type PanelLayout = {
  /**
   * Desktop sidebar preference. Older catalogs have no value and start expanded. `width` is only
   * set once the user drags the edge; without it the stylesheet's responsive default applies.
   */
  sidebar: { collapsed: boolean; width?: number };
  /**
   * The chat column's share of the chat-and-map area on desktop, set once the traveller drags the
   * divider. Without it the stylesheet's default applies (chat slightly wider than the map).
   */
  chatShare?: number;
  preferences: { open: boolean; width: number };
  trip: { open: boolean; width: number };
  view: WorkspaceView;
  day?: string;
  editorView: "overview" | "timeline" | "map";
};

export type WorkspaceCatalog = {
  version: 4;
  activeConversationId?: string;
  activeTripId?: string;
  conversations: ConversationRecord[];
  trips: TripRecord[];
  layout: PanelLayout;
};

export const SIDEBAR_WIDTH = { min: 200, default: 240, max: 420 } as const;
/** Bounds for the chat column's share of the chat-and-map area; the default is in the stylesheet. */
export const CHAT_SHARE = { min: 0.3, default: 0.56, max: 0.75 } as const;
export const clampChatShare = (share: number) =>
  Math.round(Math.min(CHAT_SHARE.max, Math.max(CHAT_SHARE.min, share)) * 1000) / 1000;
export const clampSidebarWidth = (width: number) =>
  Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, width)));

const DEFAULT_LAYOUT: PanelLayout = {
  sidebar: { collapsed: false },
  preferences: { open: true, width: 280 },
  trip: { open: true, width: 340 },
  view: "chat",
  editorView: "map",
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const validDate = (value: unknown): value is string =>
  text(value) && Number.isFinite(Date.parse(value));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function titleFor(snapshot: Snapshot): string {
  const destination = snapshot.plan.brief.destination.trim();
  const [start, end] = snapshot.plan.brief.dates;
  return destination
    ? `${destination} · ${start}${end && end !== start ? ` – ${end}` : ""}`
    : "Untitled trip";
}

/**
 * The one honest trip label. A plan is "needs review" while it still reports an
 * unresolved revision request or an overrun, and a draft otherwise. Nothing can
 * confirm a plan any more, so `status` never says "confirmed" — a stored value
 * from before this change is recomputed from the snapshot on read.
 */
export function statusForPlan(plan: TripPlan): TripStatus {
  const unresolved = plan.conflicts?.length ?? 0;
  return unresolved > 0 || plan.overrunPct > 0 ? "needs_review" : "draft";
}

function statusFor(snapshot: Snapshot): TripStatus {
  return statusForPlan(snapshot.plan);
}

/**
 * Layout is a preference, not user data: invalid or legacy values fall back to defaults per
 * field instead of making the whole catalog (and its chats and trips) unreadable.
 */
function normalizeLayout(value: unknown): PanelLayout {
  const layout = isObject(value) ? value : {};
  const panel = (key: "preferences" | "trip") => {
    const item = layout[key];
    const fallback = DEFAULT_LAYOUT[key];
    if (!isObject(item)) return { ...fallback };
    return {
      open: typeof item.open === "boolean" ? item.open : fallback.open,
      width:
        typeof item.width === "number" && Number.isFinite(item.width)
          ? Math.min(720, Math.max(180, item.width))
          : fallback.width,
    };
  };
  const sidebar = isObject(layout.sidebar) ? layout.sidebar : {};
  const view = layout.view === "map" || layout.view === "trip" ? layout.view : "chat";
  const editorView =
    layout.editorView === "overview" || layout.editorView === "timeline"
      ? layout.editorView
      : "map";
  return {
    sidebar: {
      collapsed: sidebar.collapsed === true,
      ...(typeof sidebar.width === "number" && Number.isFinite(sidebar.width)
        ? { width: clampSidebarWidth(sidebar.width) }
        : {}),
    },
    ...(typeof layout.chatShare === "number" && Number.isFinite(layout.chatShare)
      ? { chatShare: clampChatShare(layout.chatShare) }
      : {}),
    preferences: panel("preferences"),
    trip: panel("trip"),
    view,
    editorView,
    ...(text(layout.day) ? { day: layout.day } : {}),
  };
}

function conversationFrom(snapshot: Snapshot, tripId: string): ConversationRecord {
  return {
    id: `conversation:${snapshot.id}`,
    title: titleFor(snapshot),
    updatedAt: snapshot.savedAt,
    tripId,
    messages: clone(snapshot.messages),
    input: snapshot.input,
    snapshot: clone(parseSnapshot(snapshot)),
  };
}

function tripFrom(snapshot: Snapshot, conversationId?: string): TripRecord {
  const id = `trip:${snapshot.plan.tripId}`;
  return {
    id,
    title: titleFor(snapshot),
    updatedAt: snapshot.savedAt,
    status: statusFor(snapshot),
    conversationIds: conversationId ? [conversationId] : [],
    snapshot: clone(parseSnapshot(snapshot)),
  };
}

/** Build a fresh catalog from an optional current snapshot and saved snapshots. */
export function createCatalog(current?: Snapshot, saved: Snapshot[] = []): WorkspaceCatalog {
  const snapshots = [current, ...saved].filter((item): item is Snapshot => item !== undefined);
  const catalog: WorkspaceCatalog = {
    version: 4,
    conversations: [],
    trips: [],
    layout: clone(DEFAULT_LAYOUT),
  };
  for (const snapshot of snapshots) {
    const tripId = `trip:${snapshot.plan.tripId}`;
    const conversationId = `conversation:${snapshot.id}`;
    const existingTrip = catalog.trips.find((trip) => trip.id === tripId);
    if (!existingTrip) catalog.trips.push(tripFrom(snapshot, conversationId));
    else if (!existingTrip.conversationIds.includes(conversationId))
      existingTrip.conversationIds.push(conversationId);
    if (!catalog.conversations.some((conversation) => conversation.id === conversationId))
      catalog.conversations.push(conversationFrom(snapshot, tripId));
    if (snapshot === current) {
      catalog.activeTripId = tripId;
      catalog.activeConversationId = conversationId;
    }
  }
  return catalog;
}

/** Parse and migrate catalog JSON or a decoded value. This never writes to storage or mutates its input. */
export function parseCatalog(
  raw: string | unknown | null,
  legacyCurrent?: unknown,
): WorkspaceCatalog {
  if (raw === null || raw === undefined || raw === "") {
    const current = legacyCurrent === undefined ? undefined : parseSnapshot(legacyCurrent);
    return createCatalog(current);
  }
  let value: unknown;
  try {
    value = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("Workspace catalog JSON is invalid.");
  }
  if (Array.isArray(value))
    return createCatalog(
      undefined,
      value.map((item) => parseSnapshot(item)),
    );
  if (!isObject(value)) throw new Error("Workspace catalog is invalid.");
  // Version 4 is the AUD base-currency catalog. Earlier versions held plans whose stay
  // candidates carry the old `pricePerNightUsd` field and whose amounts meant USD, so
  // they cannot be parsed and there is no honest rate to migrate them with. They are
  // rejected here rather than half-read further down.
  if (value.version !== 4) throw new Error("Workspace catalog version is invalid.");
  if (!Array.isArray(value.conversations) || !Array.isArray(value.trips))
    throw new Error("Workspace catalog records are invalid.");
  const trips = value.trips.map(parseTrip);
  const conversations = value.conversations.map(parseConversation);
  const tripIds = new Set(trips.map((trip) => trip.id));
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  for (const trip of trips)
    for (const id of trip.conversationIds)
      if (!conversationIds.has(id)) throw new Error("Workspace catalog linkage is invalid.");
  for (const conversation of conversations)
    if (conversation.tripId && !tripIds.has(conversation.tripId))
      throw new Error("Workspace catalog linkage is invalid.");
  if (value.activeTripId !== undefined && !tripIds.has(value.activeTripId as string))
    throw new Error("Workspace catalog active trip is invalid.");
  if (
    value.activeConversationId !== undefined &&
    !conversationIds.has(value.activeConversationId as string)
  )
    throw new Error("Workspace catalog active conversation is invalid.");
  return {
    version: 4,
    ...(value.activeTripId === undefined ? {} : { activeTripId: value.activeTripId as string }),
    ...(value.activeConversationId === undefined
      ? {}
      : { activeConversationId: value.activeConversationId as string }),
    conversations,
    trips,
    layout: normalizeLayout(value.layout),
  };
}

function parseConversation(value: unknown): ConversationRecord {
  if (
    !isObject(value) ||
    !text(value.id) ||
    !text(value.title) ||
    !validDate(value.updatedAt) ||
    !Array.isArray(value.messages) ||
    !value.messages.every(
      (m) => isObject(m) && (m.role === "user" || m.role === "agent") && text(m.text),
    ) ||
    !text(value.input)
  )
    throw new Error("Workspace conversation is invalid.");
  if (value.tripId !== undefined && !text(value.tripId))
    throw new Error("Workspace conversation linkage is invalid.");
  if (value.renamed !== undefined && typeof value.renamed !== "boolean")
    throw new Error("Workspace conversation title state is invalid.");
  const snapshot = value.snapshot === undefined ? undefined : parseSnapshot(value.snapshot);
  if (value.draft !== undefined && !isDraft(value.draft))
    throw new Error("Workspace conversation form is invalid.");
  return {
    id: value.id,
    title: value.title,
    updatedAt: value.updatedAt,
    ...(value.tripId === undefined ? {} : { tripId: value.tripId }),
    messages: withValidAttachments(withValidActivity(clone(value.messages) as Message[])),
    input: value.input,
    ...(value.renamed ? { renamed: true } : {}),
    ...(snapshot ? { snapshot } : {}),
    ...(value.draft === undefined ? {} : { draft: clone(value.draft) as Draft }),
  };
}

function parseTrip(value: unknown): TripRecord {
  if (
    !isObject(value) ||
    !text(value.id) ||
    !text(value.title) ||
    !validDate(value.updatedAt) ||
    !Array.isArray(value.conversationIds) ||
    !value.conversationIds.every(text)
  )
    throw new Error("Workspace trip is invalid.");
  const snapshot = parseSnapshot(value.snapshot);
  return {
    id: value.id,
    title: value.title,
    updatedAt: value.updatedAt,
    // `status` is derived, not stored state: a legacy "confirmed" (or any other
    // stored value) is recomputed from the plan so an old catalog keeps loading.
    status: statusFor(snapshot),
    conversationIds: [...value.conversationIds],
    snapshot,
  };
}

export function serializeCatalog(catalog: WorkspaceCatalog): string {
  return JSON.stringify(parseCatalog(catalog));
}

export function upsertCurrent(
  catalog: WorkspaceCatalog,
  snapshot: Snapshot,
  messages: Message[] = snapshot.messages,
): WorkspaceCatalog {
  const next = parseCatalog(catalog);
  const tripId = `trip:${snapshot.plan.tripId}`;
  const conversationId = `conversation:${snapshot.id}`;
  const trip = tripFrom(snapshot, conversationId);
  const existingTrip = next.trips.findIndex((item) => item.id === tripId);
  if (existingTrip >= 0) {
    const ids = new Set(next.trips[existingTrip].conversationIds);
    ids.add(conversationId);
    next.trips[existingTrip] = { ...trip, conversationIds: [...ids] };
  } else next.trips.push(trip);
  const conversation = { ...conversationFrom(snapshot, tripId), messages: clone(messages) };
  const existingConversation = next.conversations.findIndex((item) => item.id === conversationId);
  if (existingConversation >= 0) {
    const previous = next.conversations[existingConversation];
    next.conversations[existingConversation] = previous.renamed
      ? { ...conversation, title: previous.title, renamed: true }
      : conversation;
  } else next.conversations.push(conversation);
  next.activeTripId = tripId;
  next.activeConversationId = conversationId;
  return next;
}

/** A conversation that has not produced a trip yet. */
function isBlankConversation(item: ConversationRecord): boolean {
  return !item.tripId && !item.snapshot;
}

/**
 * An untouched conversation is blank and holds nothing the user wrote. Filter defaults do not
 * count, so only the fields a person can type are read.
 */
function isUntouchedConversation(item: ConversationRecord): boolean {
  return (
    isBlankConversation(item) &&
    !item.messages.length &&
    !item.input.trim() &&
    (["destination", "start", "end", "groupSize", "budgetTotal", "nationality"] as const).every(
      (key) => !item.draft?.[key]?.trim(),
    ) &&
    !item.draft?.preferences?.length
  );
}

/**
 * The untouched conversation a new chat should reuse, or undefined when one has to be created.
 * Reusing is what keeps repeated `New chat` presses from stacking blank entries in the history.
 */
export function reusableBlankConversation(
  catalog: WorkspaceCatalog,
): ConversationRecord | undefined {
  return [...catalog.conversations]
    .filter(isUntouchedConversation)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function upsertConversationDraft(
  catalog: WorkspaceCatalog,
  conversation: Pick<ConversationRecord, "id" | "messages" | "input"> & {
    title?: string;
    draft?: Draft;
  },
): WorkspaceCatalog {
  const next = parseCatalog(catalog);
  const now = new Date().toISOString();
  const existing = next.conversations.findIndex((item) => item.id === conversation.id);
  const record: ConversationRecord = {
    id: conversation.id,
    // An autosave passes no title, so it keeps the one the conversation started with ("New chat"
    // or "New trip"); only an explicit title replaces it.
    title: conversation.title?.trim() || next.conversations[existing]?.title || "New chat",
    updatedAt: now,
    messages: clone(conversation.messages),
    input: conversation.input,
    draft: clone(conversation.draft ?? blankDraft()),
  };
  if (existing >= 0) {
    const previous = next.conversations[existing];
    next.conversations[existing] = previous.renamed
      ? { ...record, title: previous.title, renamed: true }
      : record;
  } else next.conversations.unshift(record);
  next.activeConversationId = conversation.id;
  delete next.activeTripId;
  return next;
}

export function searchCatalog(
  catalog: WorkspaceCatalog,
  query: string,
): { conversations: ConversationRecord[]; trips: TripRecord[] } {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return { conversations: [...catalog.conversations], trips: [...catalog.trips] };
  const matches = (value: string) => value.toLocaleLowerCase().includes(needle);
  return {
    conversations: catalog.conversations.filter(
      (item) => matches(item.title) || item.messages.some((message) => matches(message.text)),
    ),
    trips: catalog.trips.filter(
      (item) =>
        matches(item.title) ||
        matches(item.snapshot.plan.brief.destination) ||
        matches(item.snapshot.plan.brief.dates.join(" ")),
    ),
  };
}

export function updateCatalog(
  catalog: WorkspaceCatalog,
  patch: Partial<Pick<WorkspaceCatalog, "activeConversationId" | "activeTripId">> & {
    layout?: Partial<PanelLayout>;
  },
): WorkspaceCatalog {
  const next = parseCatalog(catalog);
  if (patch.activeConversationId !== undefined)
    next.activeConversationId = patch.activeConversationId;
  if (patch.activeTripId !== undefined) next.activeTripId = patch.activeTripId;
  if (patch.layout)
    next.layout = normalizeLayout({
      ...next.layout,
      ...patch.layout,
      sidebar: { ...next.layout.sidebar, ...patch.layout.sidebar },
      preferences: { ...next.layout.preferences, ...patch.layout.preferences },
      trip: { ...next.layout.trip, ...patch.layout.trip },
    });
  return next;
}

/** Everything the workspace needs for its first render, read from one storage pass. */
export type RestoredWorkspace = {
  /** Only set when a caller explicitly opens a plan; storage never opens a trip by itself. */
  plan?: TripPlan;
  draft: Draft;
  messages?: Message[];
  input: string;
  previousTotal?: number;
  catalog: WorkspaceCatalog;
  /** The blank conversation to continue, when the last active conversation had no trip yet. */
  conversationId?: string;
  storageEnabled: boolean;
  storageError?: string;
};

/**
 * Read history for a fresh start. The workspace always opens on a blank planning entry: a
 * previously active trip stays in Chats/Trips until the user chooses it, while an unfinished
 * blank conversation (form and input, no trip yet) is continued. Reading never writes, and
 * unreadable data stays in storage and is reported.
 */
export function restoreWorkspace(storage: Pick<Storage, "getItem">): RestoredWorkspace {
  const result: RestoredWorkspace = {
    draft: blankDraft(),
    input: "",
    catalog: createCatalog(),
    storageEnabled: true,
  };
  let current: Snapshot | undefined;
  try {
    const raw = storage.getItem(CURRENT_KEY);
    // The legacy snapshot is only migration input for history; it is not reopened.
    if (raw) current = parseSnapshot(JSON.parse(raw));
  } catch {
    result.storageEnabled = false;
    result.storageError =
      "Your last workspace could not be read. It was kept unchanged; your history may be incomplete. Retry storage or explicitly replace the unreadable workspace.";
  }
  try {
    const catalog = parseCatalog(storage.getItem(CATALOG_KEY), current);
    const active = catalog.conversations.find((item) => item.id === catalog.activeConversationId);
    // Continue the active blank chat; otherwise reuse an untouched one instead of adding
    // another empty "New chat" on every refresh.
    const conversation =
      active && isBlankConversation(active) ? active : reusableBlankConversation(catalog);
    if (conversation) {
      catalog.activeConversationId = conversation.id;
      result.conversationId = conversation.id;
      result.messages = conversation.messages;
      result.input = conversation.input;
      result.draft = conversation.draft ?? blankDraft();
    } else {
      delete catalog.activeConversationId;
    }
    delete catalog.activeTripId;
    result.catalog = catalog;
  } catch {
    result.storageEnabled = false;
    result.storageError =
      "Workspace history could not be read. Existing stored data was kept; you can still plan a new trip.";
  }
  return result;
}
