"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { TripPlan, type AgentProgressEvent } from "@trip/shared";
import type { SidebarSection } from "./WorkspaceSidebar";
import type { TripTab } from "../trip/TripPanel";
import { useWorkspaceStorage } from "./useWorkspaceStorage";
import { useWorkspaceTransport } from "./useWorkspaceTransport";
import { useTripPlaces } from "../map/useTripPlaces";
import type { RouteResult } from "@/lib/integrations/google";
import {
  identifyActivities,
  blankDraft,
  draftFor,
  money,
  type Message,
  type Snapshot,
} from "@/lib/workspace";
import {
  reusableBlankConversation,
  searchCatalog,
  updateCatalog,
  upsertConversationDraft,
  type RestoredWorkspace,
  type WorkspaceCatalog,
} from "@/lib/workspace/catalog";
import {
  seed,
  useIsNarrow,
  type DialogKind,
  type MobileView,
  type Task,
} from "./workspace-helpers";
import { useDataMode } from "@/lib/workspace/data-mode";
import { useComposerAttachments } from "./useComposerAttachments";
import type { PendingAsk } from "@/lib/workspace/ask-user";
import { firstFactWithError, firstMissingFact, type FactKey } from "@/lib/workspace/trip-facts";
export function useWorkspaceController({ restored }: { restored: RestoredWorkspace }) {
  const [plan, setPlan] = useState<TripPlan | undefined>(restored.plan);
  const [draft, setDraft] = useState(restored.draft);
  const [messages, setMessages] = useState<Message[]>(
    () => restored.messages ?? (restored.plan ? seed : []),
  );
  const [input, setInput] = useState(restored.input);
  const [previousTotal, setPreviousTotal] = useState(restored.previousTotal);
  const [editPending, setEditPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<AgentProgressEvent[]>([]);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState<Task>();
  // In memory only: a reload drops the card, and the question stays in the chat.
  const [ask, setAsk] = useState<PendingAsk>();
  const [dialog, setDialog] = useState<DialogKind>();
  const [notice, setNotice] = useState("");
  const [catalog, setCatalog] = useState<WorkspaceCatalog>(restored.catalog);
  const [historyQuery, setHistoryQuery] = useState("");
  // The top-bar chip whose editor is open; Preferences is one of them.
  const [openFact, setOpenFact] = useState<FactKey>();
  const preferencesOpen = openFact !== undefined;
  const [tripOpen, setTripOpen] = useState(false);
  const [tripTab, setTripTab] = useState<TripTab>(
    restored.catalog.layout.editorView === "timeline" ? "timeline" : "overview",
  );
  const [mobileView, setMobileView] = useState<MobileView>(
    restored.catalog.layout.view === "map" ? "map" : "chat",
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    restored.catalog.layout.sidebar.collapsed,
  );
  const [sidebarWidth, setSidebarWidth] = useState(restored.catalog.layout.sidebar.width);
  const [section, setSection] = useState<SidebarSection>("chats");
  const [navOpen, setNavOpen] = useState(false);
  const narrow = useIsNarrow();
  const [selectedActivity, setSelectedActivity] = useState<string>();
  const [mapRoutes, setMapRoutes] = useState<RouteResult[]>([]);
  const activeConversation = useRef(
    restored.conversationId ?? `conversation:${crypto.randomUUID()}`,
  );
  // The trip ID a blank conversation will use once it produces its first plan.
  const freshTripId = useRef(crypto.randomUUID());
  const planRef = useRef(plan);
  planRef.current = plan;
  const active = useRef<AbortController | null>(null);
  const preferencesToggle = useRef<HTMLButtonElement>(null);
  const tripToggle = useRef<HTMLButtonElement>(null);
  const navToggle = useRef<HTMLButtonElement>(null);
  const tripPlaces = useTripPlaces(plan);
  const {
    saved,
    storageError,
    storageEnabled,
    saveState,
    setStorageError,
    setStorageEnabled,
    flushSave,
    save,
    loadSaved,
  } = useWorkspaceStorage({
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
  });
  const blank = !plan;

  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );

  useEffect(() => {
    setCatalog((current) =>
      updateCatalog(current, {
        layout: {
          sidebar: { collapsed: sidebarCollapsed, width: sidebarWidth },
          preferences: { ...current.layout.preferences, open: preferencesOpen },
          trip: { ...current.layout.trip, open: tripOpen },
          view: mobileView,
          editorView: tripTab,
        },
      }),
    );
  }, [preferencesOpen, tripOpen, mobileView, tripTab, sidebarCollapsed, sidebarWidth]);

  // Leaving the narrow layout closes its navigation drawer.
  useEffect(() => {
    if (!narrow) setNavOpen(false);
  }, [narrow]);

  /** Stop in-flight work and clear state that belongs to the previous chat or trip. */
  function resetTransient() {
    // Persist the outgoing conversation now; its debounced save would otherwise be dropped.
    flushSave();
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setActivity([]);
    setError("");
    setErrors({});
    setRetry(undefined);
    setAsk(undefined);
    setDialog(undefined);
    setSelectedActivity(undefined);
    setMapRoutes([]);
    // Files picked for a message that was never sent belong to the chat being left.
    composerAttachments.clearAttachments();
  }
  function applySnapshot(snapshot: Snapshot) {
    setPlan(snapshot.plan);
    setDraft(snapshot.draft);
    setMessages(snapshot.messages);
    setInput(snapshot.input);
    setPreviousTotal(snapshot.previousTotal);
  }
  function openPreferences(fact: FactKey = "preferences") {
    setDialog(undefined);
    setTripOpen(false);
    setNavOpen(false);
    setOpenFact(fact);
  }
  function closePreferences() {
    setOpenFact(undefined);
  }
  function openTrip() {
    setOpenFact(undefined);
    setNavOpen(false);
    setTripOpen(true);
  }
  function closeTrip() {
    setTripOpen(false);
  }
  function openDialog(kind: DialogKind) {
    if (kind === "saved") loadSaved();
    setNavOpen(false);
    setDialog(kind);
  }
  /**
   * Opens the chip editor for the first fact still missing, or the one a rejected submission
   * points at. Called from buttons too, so anything that is not a fact key (a click event) is
   * ignored.
   */
  function edit(fact?: unknown) {
    openPreferences(
      typeof fact === "string" ? (fact as FactKey) : (firstMissingFact(draft) ?? "preferences"),
    );
  }
  const dataMode = useDataMode();
  // Files held for the next message. In memory only: a reload drops them, the
  // same way an unanswered question card is dropped.
  const composerAttachments = useComposerAttachments();
  const { run, submit, send, answer } = useWorkspaceTransport({
    plan,
    dataMode: dataMode.mode,
    draft,
    input,
    planRef,
    freshTripId,
    active,
    setBusy,
    setActivity,
    setError,
    setRetry,
    setMessages,
    setInput,
    setPreviousTotal,
    setPlan,
    setDraft,
    setErrors,
    setSelectedActivity,
    setMapRoutes,
    attachments: composerAttachments.attachments,
    clearAttachments: composerAttachments.clearAttachments,
    ask,
    setAsk,
    onReject: (fields) => openPreferences(firstFactWithError(fields) ?? "preferences"),
  });
  function restore(snapshot: Snapshot) {
    resetTransient();
    applySnapshot(snapshot);
    activeConversation.current = `conversation:${snapshot.id}`;
    setNotice("Trip restored. Future edits are saved to your current workspace.");
  }

  const filteredHistory = useMemo(
    () => searchCatalog(catalog, historyQuery),
    [catalog, historyQuery],
  );
  const historyChats = filteredHistory.conversations.map((item) => ({
    id: item.id,
    title: item.title,
    active: item.id === catalog.activeConversationId,
  }));
  const historyTrips = filteredHistory.trips.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: `${item.snapshot.plan.brief.dates.join(" – ")} · ${money(item.snapshot.plan.estTotal)}`,
    status: item.status === "needs_review" ? ("Needs review" as const) : ("Draft" as const),
    active: !blank && item.id === catalog.activeTripId,
  }));
  function selectConversation(id: string) {
    const conversation = catalog.conversations.find((item) => item.id === id);
    if (!conversation) return;
    resetTransient();
    const source =
      conversation.snapshot ??
      catalog.trips.find((item) => item.id === conversation.tripId)?.snapshot;
    if (source) applySnapshot(source);
    else {
      setPlan(undefined);
      setDraft(conversation.draft ?? blankDraft());
      setPreviousTotal(undefined);
      freshTripId.current = crypto.randomUUID();
    }
    activeConversation.current = id;
    setMessages(conversation.messages);
    setInput(conversation.input);
    setNotice("");
    setCatalog((current) => {
      const next = updateCatalog(current, {
        activeConversationId: id,
        ...(conversation.tripId ? { activeTripId: conversation.tripId } : {}),
      });
      if (!conversation.tripId) delete next.activeTripId;
      return next;
    });
    setNavOpen(false);
    setMobileView("chat");
  }
  function selectTrip(id: string) {
    const trip = catalog.trips.find((item) => item.id === id);
    if (!trip) return;
    resetTransient();
    applySnapshot(trip.snapshot);
    const conversationId = trip.conversationIds.at(-1);
    const conversation = catalog.conversations.find((item) => item.id === conversationId);
    activeConversation.current = conversation?.id ?? `conversation:${trip.snapshot.id}`;
    if (conversation) {
      setMessages(conversation.messages);
      setInput(conversation.input);
    }
    setNotice("");
    setCatalog((current) =>
      updateCatalog(current, {
        activeTripId: id,
        ...(conversation ? { activeConversationId: conversation.id } : {}),
      }),
    );
    setNavOpen(false);
  }
  /**
   * `base` is the catalog this new chat is derived from. `deleteChat` passes the already-pruned
   * catalog: React has not committed the removal yet, so reading the `catalog` closure here would
   * reuse the id of the conversation being deleted and put it straight back.
   *
   * Kept separate from `newChat` because that one is handed to `onClick`-style props, which would
   * otherwise pass a click event in as `base`.
   *
   * `kind` only changes the conversation's default name and where focus lands: a chat starts at
   * the composer, a trip at the Where editor. Both are the same blank conversation underneath.
   */
  function startBlankChat(base?: WorkspaceCatalog, kind: "chat" | "trip" = "chat") {
    resetTransient();
    // Reuse an untouched conversation so repeated New chat presses cannot stack blank history
    // entries. Only a conversation holding nothing the user wrote is safe to reuse.
    const id =
      reusableBlankConversation(base ?? catalog)?.id ?? `conversation:${crypto.randomUUID()}`;
    activeConversation.current = id;
    freshTripId.current = crypto.randomUUID();
    setPlan(undefined);
    setDraft(blankDraft());
    setMessages([]);
    setInput("");
    setPreviousTotal(undefined);
    setNotice("");
    setOpenFact(undefined);
    setTripOpen(false);
    setNavOpen(false);
    setCatalog((current) =>
      upsertConversationDraft(base ?? current, {
        id,
        messages: [],
        input: "",
        draft: blankDraft(),
        title: kind === "trip" ? "New trip" : "New chat",
      }),
    );
    setMobileView("chat");
    // A new trip starts from its destination; the Where editor moves focus to its own field.
    if (kind === "trip") {
      setOpenFact("where");
      return;
    }
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLInputElement>('[aria-label="Message AI Trip Planner"]')
        ?.focus({ preventScroll: true }),
    );
  }
  function newChat() {
    startBlankChat();
  }
  /** A blank trip: the same fresh conversation as New chat, opened on the Where editor. */
  function newTrip() {
    startBlankChat(undefined, "trip");
  }
  function renameChat(id: string) {
    const existing = catalog.conversations.find((item) => item.id === id);
    if (!existing) return;
    const title = window.prompt("Rename chat", existing.title)?.trim();
    if (!title) return;
    setCatalog((current) => ({
      ...current,
      conversations: current.conversations.map((item) =>
        item.id === id
          ? { ...item, title, renamed: true, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  }
  function withoutConversation(source: WorkspaceCatalog, id: string): WorkspaceCatalog {
    return {
      ...source,
      activeConversationId:
        source.activeConversationId === id ? undefined : source.activeConversationId,
      conversations: source.conversations.filter((item) => item.id !== id),
      trips: source.trips.map((item) => ({
        ...item,
        conversationIds: item.conversationIds.filter((conversationId) => conversationId !== id),
      })),
    };
  }
  function deleteChat(id: string) {
    const existing = catalog.conversations.find((item) => item.id === id);
    if (!existing || !window.confirm(`Delete “${existing.title}”? The linked trip will be kept.`))
      return;
    // Deleting the open chat has to remove it and open a fresh one in a single update. Splitting
    // it in two let `newChat` read the pre-delete catalog, reuse the deleted conversation's id and
    // put it straight back, so the chat could never be deleted.
    if (activeConversation.current === id) startBlankChat(withoutConversation(catalog, id));
    else setCatalog((current) => withoutConversation(current, id));
  }
  // The trip badge counts unresolved revision requests — the only thing the
  // product can still report as outstanding. There is no decision to make.
  const pending = plan?.conflicts?.length ?? 0;
  const dialogTitle =
    dialog === "review"
      ? "Review plan"
      : dialog === "saved"
        ? "Saved trips"
        : dialog === "language"
          ? "Language"
          : "Local account";
  // Chip editors are popovers, not drawers: they bring no drawer backdrop.
  const drawerOpen = tripOpen || navOpen;

  return {
    plan,
    dataMode,
    draft,
    messages,
    input,
    previousTotal,
    editPending,
    busy,
    activity,
    error,
    errors,
    retry,
    ask,
    dialog,
    saved,
    storageError,
    storageEnabled,
    saveState,
    catalog,
    historyQuery,
    preferencesOpen,
    tripOpen,
    tripTab,
    mobileView,
    sidebarCollapsed,
    sidebarWidth,
    section,
    navOpen,
    narrow,
    selectedActivity,
    mapRoutes,
    tripPlaces,
    historyChats,
    historyTrips,
    notice,
    composerAttachments,
    blank,
    pending,
    dialogTitle,
    drawerOpen,
    openFact,
    preferencesToggle,
    tripToggle,
    navToggle,
    setPlan,
    setDraft,
    setInput,
    setPreviousTotal,
    setEditPending,
    setDialog,
    setStorageError,
    setStorageEnabled,
    setNotice,
    setHistoryQuery,
    setTripOpen,
    setTripTab,
    setMobileView,
    setSidebarCollapsed,
    setSidebarWidth,
    setSection,
    setNavOpen,
    setSelectedActivity,
    setMapRoutes,
    openPreferences,
    closePreferences,
    openTrip,
    closeTrip,
    openDialog,
    edit,
    /** Keeps a chip's edit in the draft without planning. */
    saveFacts: (next: typeof draft) => setDraft(next),
    /** Keeps a chip's edit and plans with the whole brief; false when it was rejected. */
    planWith: (next: typeof draft) => {
      setDraft(next);
      return submit(next);
    },
    restore,
    save,
    loadSaved,
    run,
    submit,
    send,
    answer,
    dismissAsk: () => setAsk(undefined),
    newChat,
    newTrip,
    selectConversation,
    selectTrip,
    renameChat,
    deleteChat,
    onCancel: () => active.current?.abort(),
  };
}
export type WorkspaceController = ReturnType<typeof useWorkspaceController>;
