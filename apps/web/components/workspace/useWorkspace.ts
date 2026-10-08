"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceStorage } from "./useWorkspaceStorage";
import { useWorkspaceTransport } from "./useWorkspaceTransport";
import { useTripPlaces } from "../map/useTripPlaces";
import { effectiveCurrency, type TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import { blankDraft, type Draft } from "@/lib/workspace";
import {
  reusableBlankConversation,
  searchCatalog,
  updateCatalog,
  upsertConversationDraft,
  type RestoredWorkspace,
  type WorkspaceCatalog,
} from "@/lib/workspace/catalog";
import { seed, type DialogKind, type MobileView } from "./workspace-helpers";
import { useWorkspaceLayout } from "./useWorkspaceLayout";
import {
  idleSession,
  session as nextSession,
  type SavedSession,
  type SessionEvent,
  type SessionState,
} from "@/lib/workspace/session";
import { useDataMode } from "@/lib/workspace/data-mode";
import { draftDefaults } from "@/lib/account/settings";
import { useSettings } from "../account/SettingsProvider";
import { useInterfaceLocale } from "../account/LocaleProvider";
import { useAccountSync } from "../account/useAccountSync";
import type { SettingsSection } from "../account/SettingsDialog";
import { useComposerAttachments } from "./useComposerAttachments";
import { firstFactWithError, firstMissingFact, type FactKey } from "@/lib/workspace/trip-facts";
import { translate } from "@/lib/i18n/locale";
import { moneyDisplay } from "@/lib/money";
/**
 * The workspace the views read and act on, in four groups: `session` (the open chat and trip and
 * what a traveller can do with them), `layout` (what is open on screen), `itinerary` (the open
 * trip's stops and ideas) and `history` (saved chats and trips). No raw state setter leaves this
 * hook; where one action changes two groups (opening a trip also decides what is on screen), the
 * link is written here once.
 */
export function useWorkspace({ restored }: { restored: RestoredWorkspace }) {
  // The conversation and trip a planning turn changes; only `session()` moves it.
  // The question card is in memory only: a reload drops it, and the question stays in the chat.
  const [state, setSession] = useState<SessionState>(() =>
    idleSession({
      plan: restored.plan,
      draft: restored.draft,
      messages: restored.messages ?? (restored.plan ? seed : []),
      input: restored.input,
      previousTotal: restored.previousTotal,
    }),
  );
  const { plan, draft, messages, input, previousTotal, ask, selectedActivity } = state;
  // Stable, so effects in the views can depend on the actions built from it.
  const [dispatch] = useState(
    () => (event: SessionEvent) => setSession((current) => nextSession(current, event)),
  );
  const [editPending, setEditPending] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("personalization");
  const [catalog, setCatalog] = useState<WorkspaceCatalog>(restored.catalog);
  const { settings } = useSettings();
  const locale = useInterfaceLocale();
  const t = (
    text: import("@/lib/i18n/locale").MessageKey,
    params?: Record<string, string | number>,
  ) => translate(locale, text, params);
  const [historyQuery, setHistoryQuery] = useState("");
  // What is open on screen: page, view, the one open panel and a dialog (lib/workspace/layout).
  const {
    surface,
    phone,
    narrow,
    dispatch: layout,
  } = useWorkspaceLayout(restored.catalog.layout.view);
  const { dialog, fact: openFact, view: mobileView } = surface;
  const tripOpen = surface.drawer === "trip";
  const navOpen = surface.drawer === "nav";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    restored.catalog.layout.sidebar.collapsed,
  );
  const [sidebarWidth, setSidebarWidth] = useState(restored.catalog.layout.sidebar.width);
  const [chatShare, setChatShare] = useState(restored.catalog.layout.chatShare);
  // The phone map's day, and a counter the map watches to centre on the selected stop.
  const [mapDay, setMapDay] = useState<number>();
  const [mapFocus, setMapFocus] = useState(0);
  const isPhone = useRef(phone);
  isPhone.current = phone;
  const activeConversation = useRef(
    restored.conversationId ?? `conversation:${crypto.randomUUID()}`,
  );
  // The trip ID a blank conversation will use once it produces its first plan.
  const freshTripId = useRef(crypto.randomUUID());
  const active = useRef<AbortController | null>(null);
  const preferencesToggle = useRef<HTMLButtonElement>(null);
  const tripToggle = useRef<HTMLButtonElement>(null);
  const navToggle = useRef<HTMLButtonElement>(null);
  const tripPlaces = useTripPlaces(plan);
  const { itinerary } = tripPlaces;
  const { storageError, storageEnabled, saveState, setStorageError, setStorageEnabled, flushSave } =
    useWorkspaceStorage({
      restored,
      plan,
      draft,
      messages,
      input,
      previousTotal,
      catalog,
      setCatalog,
      activeConversation,
    });
  const syncStatus = useAccountSync({ catalog, setCatalog, storageEnabled });
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
          chatShare,
          view: mobileView,
        },
      }),
    );
  }, [mobileView, sidebarCollapsed, sidebarWidth, chatShare]);

  // A stop selected anywhere (the Trip tab's itinerary too) shows on its own day on the phone map.
  const selectedDay = selectedActivity ? itinerary.stop(selectedActivity)?.day : undefined;
  useEffect(() => {
    if (phone && selectedDay !== undefined) setMapDay(selectedDay);
  }, [phone, selectedDay]);

  /**
   * Leaves the open chat or trip for `saved`: stops in-flight work and drops state that belonged
   * to the one being left.
   */
  function open(saved: SavedSession) {
    // Persist the outgoing conversation now; its debounced save would otherwise be dropped.
    flushSave();
    active.current?.abort();
    active.current = null;
    dispatch({ kind: "opened", saved });
    // Files picked for a message that was never sent belong to the chat being left.
    composerAttachments.clearAttachments();
  }
  function openPreferences(fact: FactKey = "preferences") {
    layout({ type: "open-fact", fact });
  }
  function openSettings(section: SettingsSection = "personalization") {
    setSettingsSection(section);
    layout({ type: "open-dialog", dialog: "settings" });
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
  const dataMode = useDataMode(settings.dataMode === "default" ? undefined : settings.dataMode);
  // Files held for the next message. In memory only: a reload drops them, the
  // same way an unanswered question card is dropped.
  const composerAttachments = useComposerAttachments();
  const { run, submit, send, answer } = useWorkspaceTransport({
    plan,
    dataMode: dataMode.mode,
    assistant: settings.assistant,
    interfaceLanguage: locale,
    displayCurrency: settings.displayCurrency,
    draft,
    input,
    freshTripId,
    active,
    dispatch,
    attachments: composerAttachments.attachments,
    clearAttachments: composerAttachments.clearAttachments,
    ask,
    onReject: (fields) => openPreferences(firstFactWithError(fields) ?? "preferences"),
  });

  const filteredHistory = useMemo(
    () => searchCatalog(catalog, historyQuery),
    [catalog, historyQuery],
  );
  const historyChats = filteredHistory.conversations.map((item) => {
    const trip = item.tripId && catalog.trips.find((record) => record.id === item.tripId);
    return {
      id: item.id,
      title: item.title,
      subtitle: trip
        ? t("Trip to {destination}", { destination: trip.snapshot.plan.brief.destination })
        : undefined,
      active: item.id === catalog.activeConversationId,
    };
  });
  const historyTrips = filteredHistory.trips.map((item) => ({
    id: item.id,
    title: t("Trip to {destination}", { destination: item.snapshot.plan.brief.destination }),
    destination: item.snapshot.plan.brief.destination,
    subtitle: `${item.snapshot.plan.brief.dates.join(" – ")} · ${moneyDisplay({
      currency: effectiveCurrency(item.snapshot.plan.brief, settings.displayCurrency),
      locale,
    }).money(item.snapshot.plan.estTotal)}`,
    status: item.status === "needs_review" ? ("Needs review" as const) : ("Draft" as const),
    active: !blank && item.id === catalog.activeTripId,
  }));
  function selectConversation(id: string) {
    const conversation = catalog.conversations.find((item) => item.id === id);
    if (!conversation) return;
    const source =
      conversation.snapshot ??
      catalog.trips.find((item) => item.id === conversation.tripId)?.snapshot;
    if (!source) freshTripId.current = crypto.randomUUID();
    open({
      ...(source
        ? { plan: source.plan, previousTotal: source.previousTotal }
        : { plan: undefined, previousTotal: undefined }),
      draft: source ? source.draft : (conversation.draft ?? blankDraft()),
      messages: conversation.messages,
      input: conversation.input,
    });
    activeConversation.current = id;
    setCatalog((current) => {
      const next = updateCatalog(current, {
        activeConversationId: id,
        ...(conversation.tripId ? { activeTripId: conversation.tripId } : {}),
      });
      if (!conversation.tripId) delete next.activeTripId;
      return next;
    });
    layout({ type: "chat-opened" });
  }
  function selectTrip(id: string) {
    const trip = catalog.trips.find((item) => item.id === id);
    if (!trip) return;
    const conversationId = trip.conversationIds.at(-1);
    const conversation = catalog.conversations.find((item) => item.id === conversationId);
    open({
      ...trip.snapshot,
      ...(conversation ? { messages: conversation.messages, input: conversation.input } : {}),
    });
    activeConversation.current = conversation?.id ?? `conversation:${trip.snapshot.id}`;
    setCatalog((current) =>
      updateCatalog(current, {
        activeTripId: id,
        ...(conversation ? { activeConversationId: conversation.id } : {}),
      }),
    );
    layout({ type: "trip-opened" });
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
    // Reuse an untouched conversation so repeated New chat presses cannot stack blank history
    // entries. Only a conversation holding nothing the user wrote is safe to reuse.
    const defaults = draftDefaults(settings);
    const id =
      reusableBlankConversation(base ?? catalog, defaults)?.id ??
      `conversation:${crypto.randomUUID()}`;
    open({ plan: undefined, previousTotal: undefined, draft: defaults, messages: [], input: "" });
    activeConversation.current = id;
    freshTripId.current = crypto.randomUUID();
    setCatalog((current) =>
      upsertConversationDraft(base ?? current, {
        id,
        messages: [],
        input: "",
        draft: defaults,
        title: kind === "trip" ? "New trip" : "New chat",
      }),
    );
    // A new trip starts from its destination; the Where editor moves focus to its own field.
    layout({ type: "chat-started", fact: kind === "trip" ? "where" : undefined });
    if (kind === "trip") return;
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLInputElement>(".composer textarea")
        ?.focus({ preventScroll: true }),
    );
  }
  function renameChat(id: string) {
    const existing = catalog.conversations.find((item) => item.id === id);
    if (!existing) return;
    const title = window.prompt(t("Rename chat"), existing.title)?.trim();
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
    if (
      !existing ||
      !window.confirm(
        t("Delete “{title}”? The linked trip will be kept.", { title: existing.title }),
      )
    )
      return;
    // Deleting the open chat has to remove it and open a fresh one in a single update. Splitting
    // it in two let `newChat` read the pre-delete catalog, reuse the deleted conversation's id and
    // put it straight back, so the chat could never be deleted.
    if (activeConversation.current === id) startBlankChat(withoutConversation(catalog, id));
    else setCatalog((current) => withoutConversation(current, id));
  }

  // Stable, so effects in the views can depend on them.
  const [stable] = useState(() => ({
    session: {
      /** Applies a change made by hand and records the total it replaced. */
      applyEdit: (next: TripPlan) => dispatch({ kind: "edited", plan: next }),
      type: (text: string) => dispatch({ kind: "typed", input: text }),
      /** Keeps a chip's edit in the draft without planning. */
      saveFacts: (next: Draft) => dispatch({ kind: "drafted", draft: next }),
      selectStop: (id: string | undefined) => dispatch({ kind: "selected", activity: id }),
      /** Selects a stop on the map and, on a phone, centres the map on it. */
      showStop: (id: string) => {
        dispatch({ kind: "selected", activity: id });
        if (isPhone.current) setMapFocus((request) => request + 1);
      },
      showRoutes: (routes: RouteResult[]) => dispatch({ kind: "routed", routes }),
      /** A timeline edit is being previewed; planning waits until it is applied or dropped. */
      trackEdit: (pending: boolean) => setEditPending(pending),
      dismissAsk: () => dispatch({ kind: "dismissed" }),
      cancel: () => active.current?.abort(),
    },
    layout: {
      closeDialog: () => layout({ type: "close-dialog" }),
      openNav: () => layout({ type: "open-nav" }),
      /** Closes the Trip drawer, the navigation drawer or the Chats panel, whichever is open. */
      closeDrawer: () => layout({ type: "close-drawer" }),
      toggleChats: () => layout({ type: "toggle-chats" }),
      showTrips: () => layout({ type: "show-trips" }),
      selectView: (view: MobileView) => layout({ type: "select-view", view }),
      openFactsSheet: () => layout({ type: "open-sheet" }),
      closeFactsSheet: () => layout({ type: "close-sheet" }),
      closePreferences: () => layout({ type: "close-fact" }),
      openTrip: () => layout({ type: "open-trip" }),
      closeTrip: () => layout({ type: "close-trip" }),
      openDialog: (kind: DialogKind) => layout({ type: "open-dialog", dialog: kind }),
      toggleSidebar: () => setSidebarCollapsed((value) => !value),
      resizeSidebar: (width: number | undefined) => setSidebarWidth(width),
      resizeChat: (share: number | undefined) => setChatShare(share),
      /** Shows a day on the phone map; the selected stop stays. */
      showMapDay: (day: number | undefined) => setMapDay(day),
      /** The traveller picked a day on the phone map: the stop selected on another day goes. */
      pickMapDay: (day: number) => {
        setMapDay(day);
        dispatch({ kind: "selected", activity: undefined });
      },
    },
    history: {
      search: (query: string) => setHistoryQuery(query),
      retryStorage: () => {
        setStorageError(undefined);
        setStorageEnabled(true);
      },
    },
  }));

  return {
    session: {
      plan,
      draft,
      messages,
      input,
      previousTotal,
      busy: state.busy,
      activity: state.activity,
      error: state.error,
      errors: state.errors,
      /** Whether the last failed turn can be sent again. */
      canRetry: state.retry !== undefined,
      ask,
      selectedActivity,
      mapRoutes: state.mapRoutes,
      editPending,
      blank,
      dataMode,
      /** The open trip's places, looked up once for the map, the trip list and the timeline. */
      places: tripPlaces,
      attachments: composerAttachments,
      ...stable.session,
      send,
      answer,
      /** Sends the last failed turn again. */
      retry: () => {
        if (state.retry) void run(state.retry);
      },
      /** Keeps a chip's edit and plans with the whole brief; false when it was rejected. */
      planWith: (next: Draft) => {
        dispatch({ kind: "drafted", draft: next });
        return submit(next);
      },
      selectTrip,
      selectConversation,
      newChat: () => startBlankChat(),
      /** A blank trip: the same fresh conversation as New chat, opened on the Where editor. */
      newTrip: () => startBlankChat(undefined, "trip"),
    },
    layout: {
      surface,
      phone,
      narrow,
      page: surface.page,
      mobileView,
      dialog,
      openFact,
      preferencesOpen: openFact !== undefined,
      tripOpen,
      navOpen,
      chatsOpen: surface.drawer === "chats",
      // Chip editors are popovers, not drawers: they bring no drawer backdrop.
      drawerOpen: tripOpen || navOpen,
      sidebarCollapsed,
      sidebarWidth,
      chatShare,
      mapDay,
      mapFocus,
      settingsSection,
      preferencesToggle,
      tripToggle,
      navToggle,
      ...stable.layout,
      openPreferences,
      openSettings,
      edit,
    },
    /** The open trip's stops and ideas; the trip badge counts its stops, never ideas. */
    itinerary,
    history: {
      catalog,
      query: historyQuery,
      chats: historyChats,
      trips: historyTrips,
      saveState,
      syncStatus,
      storageError,
      ...stable.history,
      rename: renameChat,
      delete: deleteChat,
    },
  };
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>;
