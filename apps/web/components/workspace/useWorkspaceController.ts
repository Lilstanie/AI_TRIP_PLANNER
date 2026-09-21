"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { TripPlan, type AgentProgressEvent } from "@trip/shared";
import type { SidebarSection } from "./WorkspaceSidebar";
import { pendingDecisions, type TripTab } from "../trip/TripPanel";
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
  tripFacts,
  useIsNarrow,
  type DialogKind,
  type MobileView,
  type Task,
} from "./workspace-helpers";
import { useDataMode } from "@/lib/workspace/data-mode";
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
  const [dialog, setDialog] = useState<DialogKind>();
  const [notice, setNotice] = useState("");
  const [catalog, setCatalog] = useState<WorkspaceCatalog>(restored.catalog);
  const [historyQuery, setHistoryQuery] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
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
  const left = useRef<HTMLDivElement>(null);
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
    setDialog(undefined);
    setSelectedActivity(undefined);
    setMapRoutes([]);
  }
  function applySnapshot(snapshot: Snapshot) {
    setPlan(snapshot.plan);
    setDraft(snapshot.draft);
    setMessages(snapshot.messages);
    setInput(snapshot.input);
    setPreviousTotal(snapshot.previousTotal);
  }
  function openPreferences() {
    setDialog(undefined);
    setTripOpen(false);
    setNavOpen(false);
    setPreferencesOpen(true);
  }
  function closePreferences() {
    setPreferencesOpen(false);
  }
  function openTrip() {
    setPreferencesOpen(false);
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
  function edit() {
    openPreferences();
    requestAnimationFrame(() => {
      left.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    });
  }
  const dataMode = useDataMode();
  const { run, submit, send, onDecision } = useWorkspaceTransport({
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
    onReject: edit,
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
    subtitle: item.tripId
      ? (catalog.trips.find((trip) => trip.id === item.tripId)?.title ?? "Linked trip")
      : "No trip yet",
    updatedAt: item.updatedAt,
    active: item.id === catalog.activeConversationId,
  }));
  const historyTrips = filteredHistory.trips.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: `${item.snapshot.plan.brief.dates.join(" – ")} · ${money(item.snapshot.plan.estTotal)}`,
    updatedAt: item.updatedAt,
    status:
      item.status === "needs_review"
        ? ("Needs review" as const)
        : item.status === "confirmed"
          ? ("Confirmed" as const)
          : ("Draft" as const),
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
   */
  function startBlankChat(base?: WorkspaceCatalog) {
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
    setPreferencesOpen(false);
    setTripOpen(false);
    setNavOpen(false);
    setCatalog((current) =>
      upsertConversationDraft(base ?? current, {
        id,
        messages: [],
        input: "",
        draft: blankDraft(),
      }),
    );
    setMobileView("chat");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLInputElement>('[aria-label="Message AI Trip Planner"]')
        ?.focus({ preventScroll: true }),
    );
  }
  function newChat() {
    startBlankChat();
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
  const pending = pendingDecisions(plan);
  const dialogTitle =
    dialog === "review"
      ? "Review plan"
      : dialog === "saved"
        ? "Saved trips"
        : dialog === "language"
          ? "Language"
          : "Local account";
  const facts = plan ? tripFacts(plan) : [];
  const drawerOpen = preferencesOpen || tripOpen || navOpen;

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
    blank,
    pending,
    dialogTitle,
    facts,
    drawerOpen,
    left,
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
    setPreferencesOpen,
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
    restore,
    save,
    loadSaved,
    run,
    submit,
    send,
    onDecision,
    newChat,
    selectConversation,
    selectTrip,
    renameChat,
    deleteChat,
    onCancel: () => active.current?.abort(),
  };
}
export type WorkspaceController = ReturnType<typeof useWorkspaceController>;
