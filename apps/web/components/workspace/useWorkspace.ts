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
import { seed, type MobileView } from "./workspace-helpers";
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

export function useWorkspace({ restored }: { restored: RestoredWorkspace }) {
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

  const [mapDay, setMapDay] = useState<number>();
  const [mapFocus, setMapFocus] = useState(0);
  const isPhone = useRef(phone);
  isPhone.current = phone;
  const activeConversation = useRef(
    restored.conversationId ?? `conversation:${crypto.randomUUID()}`,
  );

  const freshTripId = useRef(crypto.randomUUID());
  const active = useRef<AbortController | null>(null);
  const preferencesToggle = useRef<HTMLButtonElement>(null);
  const tripToggle = useRef<HTMLButtonElement>(null);
  const navToggle = useRef<HTMLButtonElement>(null);
  const dataMode = useDataMode(settings.dataMode === "default" ? undefined : settings.dataMode);
  const tripPlaces = useTripPlaces(
    plan,
    dataMode.mode,
    locale,
    dataMode.providers?.webMapsProvider === "osm" ||
      (dataMode.mode === "mock" && dataMode.providers?.mockGoogleUnavailable),
    dataMode.providers?.webMapsProvider !== "google",
  );
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

  const selectedDay = selectedActivity ? itinerary.stop(selectedActivity)?.day : undefined;
  useEffect(() => {
    if (phone && selectedDay !== undefined) setMapDay(selectedDay);
  }, [phone, selectedDay]);

  function open(saved: SavedSession) {
    flushSave();
    active.current?.abort();
    active.current = null;
    dispatch({ kind: "opened", saved });

    composerAttachments.clearAttachments();
  }
  function openPreferences(fact: FactKey = "preferences") {
    layout({ type: "open-fact", fact });
  }
  function openSettings(section: SettingsSection = "personalization") {
    setSettingsSection(section);
    layout({ type: "open-dialog", dialog: "settings" });
  }

  function edit(fact?: unknown) {
    openPreferences(
      typeof fact === "string" ? (fact as FactKey) : (firstMissingFact(draft) ?? "preferences"),
    );
  }

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

  function startBlankChat(base?: WorkspaceCatalog, kind: "chat" | "trip" = "chat") {
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

    if (activeConversation.current === id) startBlankChat(withoutConversation(catalog, id));
    else setCatalog((current) => withoutConversation(current, id));
  }

  const [stable] = useState(() => ({
    session: {
      applyEdit: (next: TripPlan) => dispatch({ kind: "edited", plan: next }),
      type: (text: string) => dispatch({ kind: "typed", input: text }),

      saveFacts: (next: Draft) => dispatch({ kind: "drafted", draft: next }),
      selectStop: (id: string | undefined) => dispatch({ kind: "selected", activity: id }),

      showStop: (id: string) => {
        dispatch({ kind: "selected", activity: id });
        if (isPhone.current) setMapFocus((request) => request + 1);
      },
      showRoutes: (routes: RouteResult[]) => dispatch({ kind: "routed", routes }),

      trackEdit: (pending: boolean) => setEditPending(pending),
      dismissAsk: () => dispatch({ kind: "dismissed" }),
      dismissEstimate: () => dispatch({ kind: "estimateDismissed" }),

      setTimelineChanged: (changed: boolean) => dispatch({ kind: "timelineChanged", changed }),
      dismissReplaced: () => dispatch({ kind: "replacedDismissed" }),
      cancel: () => active.current?.abort(),
    },
    layout: {
      closeDialog: () => layout({ type: "close-dialog" }),
      openNav: () => layout({ type: "open-nav" }),

      closeDrawer: () => layout({ type: "close-drawer" }),
      toggleChats: () => layout({ type: "toggle-chats" }),
      showTrips: () => layout({ type: "show-trips" }),
      selectView: (view: MobileView) => layout({ type: "select-view", view }),
      openFactsSheet: () => layout({ type: "open-sheet" }),
      closeFactsSheet: () => layout({ type: "close-sheet" }),
      closePreferences: () => layout({ type: "close-fact" }),
      openTrip: () => layout({ type: "open-trip" }),
      closeTrip: () => layout({ type: "close-trip" }),
      toggleSidebar: () => setSidebarCollapsed((value) => !value),
      resizeSidebar: (width: number | undefined) => setSidebarWidth(width),
      resizeChat: (share: number | undefined) => setChatShare(share),

      showMapDay: (day: number | undefined) => setMapDay(day),

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

      canRetry: state.retry !== undefined,
      ask,
      selectedActivity,
      mapRoutes: state.mapRoutes,
      estimateChange: state.estimateChange,
      replacedChange: state.replacedChange,
      editPending,
      blank,
      dataMode,

      places: tripPlaces,
      attachments: composerAttachments,
      ...stable.session,
      send,
      answer,

      retry: () => {
        if (state.retry) void run(state.retry);
      },

      planWith: (next: Draft) => {
        dispatch({ kind: "drafted", draft: next });
        return submit(next);
      },
      selectTrip,
      selectConversation,
      newChat: () => startBlankChat(),

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
