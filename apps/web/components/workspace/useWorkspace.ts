"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceStorage } from "./useWorkspaceStorage";
import { useWorkspaceTransport } from "./useWorkspaceTransport";
import { useTripDay } from "../trip/useTripDay";
import { savedBrowsing, rememberBrowsing, validSelectedStop } from "@/lib/workspace/browsing";
import { useTripPlaces } from "../map/useTripPlaces";
import { effectiveCurrency, type TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import type { QuestionProgress } from "@/lib/workspace/ask-user";
import { blankDraft, type Draft } from "@/lib/workspace";
import {
  reusableBlankConversation,
  conversationTitle,
  searchCatalog,
  updateCatalog,
  upsertConversationDraft,
  type ConversationRecord,
  type RestoredWorkspace,
  type TripRecord,
  type WorkspaceCatalog,
} from "@/lib/workspace/catalog";
import { distinctTripTitles, tripMeta, tripName } from "@/lib/workspace/trip-identity";
import { seed, type MobileView } from "./workspace-helpers";
import type { ChatView } from "../chat/ChatViewTabs";
import { useWorkspaceLayout } from "./useWorkspaceLayout";
import {
  idleSession,
  session as nextSession,
  type SavedSession,
  type SessionEvent,
  type SessionState,
} from "@/lib/workspace/session";
import { mapProviderOptions, useDataMode } from "@/lib/workspace/data-mode";
import { defaultSettings, draftDefaults } from "@/lib/account/settings";
import { useSettings } from "../account/SettingsProvider";
import { useInterfaceLocale } from "../account/LocaleProvider";
import { useAccountSync } from "../account/useAccountSync";
import type { SettingsSection } from "../account/SettingsDialog";
import { useComposerAttachments } from "./useComposerAttachments";
import { firstFactWithError, firstMissingFact, type FactKey } from "@/lib/workspace/trip-facts";
import { translate } from "@/lib/i18n/locale";
import { moneyDisplay } from "@/lib/money";
import { destinationCities } from "@/lib/map/place-query";

export function useWorkspace({ restored }: { restored: RestoredWorkspace }) {
  const [state, setSession] = useState<SessionState>(() =>
    idleSession({
      plan: restored.plan,
      selectedActivity: savedBrowsing(restored.plan).selected,
      draft: restored.draft,
      messages: restored.messages ?? (restored.plan ? seed : []),
      input: restored.input,
      ask: restored.ask,
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
  const [deletedTrip, setDeletedTrip] = useState<{
    trip: TripRecord;
    linked: ConversationRecord[];
    name: string;
  }>();

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
  const mapProvider = mapProviderOptions(dataMode.mode, dataMode.providers);
  const tripPlaces = useTripPlaces(
    plan,
    dataMode.mode,
    locale,
    mapProvider.forceOsm,
    mapProvider.allowFallback,
  );
  const { itinerary } = tripPlaces;
  const { day: mapDay, selectDay: setMapDay } = useTripDay(
    plan,
    tripPlaces.destinations[0],
    selectedActivity,
    undefined,
    tripPlaces.destinationsSettled,
  );
  const browsingActions = useRef({ setMapDay, plan });
  browsingActions.current = { setMapDay, plan };
  const selectedByTrip = useRef(new Map<string, string | undefined>());
  if (plan) selectedByTrip.current.set(plan.tripId, selectedActivity);
  useEffect(() => {
    if (plan) rememberBrowsing(plan.tripId, { selected: selectedActivity });
  }, [plan, selectedActivity]);
  const firstPlannedCity = plan
    ? destinationCities(plan.brief.destination)[0]?.toLocaleLowerCase()
    : undefined;
  const plannedLocation = firstPlannedCity
    ? tripPlaces.destinations.find(
        (place) => place.displayName?.text?.toLocaleLowerCase() === firstPlannedCity,
      )?.location
    : undefined;
  const { storageError, storageEnabled, saveState, setStorageError, setStorageEnabled, flushSave } =
    useWorkspaceStorage({
      restored,
      plan,
      draft,
      messages,
      input,
      ask,
      previousTotal,
      catalog,
      setCatalog,
      activeConversation,
    });
  const syncStatus = useAccountSync({ catalog, setCatalog, storageEnabled });
  const blank = !plan;
  const profileKey = JSON.stringify(draftDefaults(settings));
  const appliedDefaults = useRef(draftDefaults(defaultSettings()));
  useEffect(() => {
    const next = JSON.parse(profileKey) as Draft;
    dispatch({ kind: "defaults-changed", previous: appliedDefaults.current, next });
    appliedDefaults.current = next;
  }, [profileKey, dispatch]);

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

  function open(saved: SavedSession) {
    flushSave();
    active.current?.abort();
    active.current = null;
    const restoredSelection =
      saved.plan &&
      (selectedByTrip.current.has(saved.plan.tripId)
        ? selectedByTrip.current.get(saved.plan.tripId)
        : savedBrowsing(saved.plan).selected);
    dispatch({
      kind: "opened",
      saved: { ...saved, selectedActivity: validSelectedStop(saved.plan, restoredSelection) },
    });

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
    planDestinationLocation:
      plan && plannedLocation
        ? {
            ...plannedLocation,
            destination: plan.brief.destination,
          }
        : undefined,
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

  const tripTitles = distinctTripTitles(catalog.trips, (item) => tripName(item, t));
  const filteredHistory = searchCatalog(catalog, historyQuery, (item) => [
    tripTitles.get(item.id)!,
    tripMeta(item, locale, settings.displayCurrency, t),
  ]);
  const historyChats = filteredHistory.conversations.map((item) => {
    const trip = item.tripId && catalog.trips.find((record) => record.id === item.tripId);
    return {
      id: item.id,
      title: conversationTitle(item, locale),
      subtitle: trip ? tripTitles.get(trip.id) : undefined,
      active: item.id === catalog.activeConversationId,
    };
  });
  const activeTrip = blank
    ? undefined
    : catalog.trips.find((item) => item.id === catalog.activeTripId);
  const historyTrips = filteredHistory.trips.map((item) => ({
    id: item.id,
    title: tripTitles.get(item.id)!,
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
      ask: conversation.ask,
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

  function renameTrip(id: string) {
    const existing = catalog.trips.find((item) => item.id === id);
    if (!existing) return;
    const title = window.prompt(t("Rename trip"), tripName(existing, t))?.trim();
    if (!title) return;
    setCatalog((current) => ({
      ...current,
      trips: current.trips.map((item) =>
        item.id === id
          ? { ...item, title, renamed: true, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  }
  function deleteTrip(id: string) {
    const trip = catalog.trips.find((item) => item.id === id);
    if (!trip) return;
    const linked = catalog.conversations.filter((item) => item.tripId === id);
    const next: WorkspaceCatalog = {
      ...catalog,
      activeTripId: catalog.activeTripId === id ? undefined : catalog.activeTripId,
      trips: catalog.trips.filter((item) => item.id !== id),
      conversations: catalog.conversations.map((item) => {
        if (item.tripId !== id) return item;
        const { tripId: _trip, snapshot: _snapshot, ...rest } = item;
        return { ...rest, updatedAt: new Date().toISOString() };
      }),
    };
    if (catalog.activeTripId === id) startBlankChat(next);
    else setCatalog(next);
    setDeletedTrip({ trip, linked, name: tripName(trip, t) });
  }
  function undoDeleteTrip() {
    if (!deletedTrip) return;
    const { trip, linked } = deletedTrip;
    const restored = new Map(linked.map((item) => [item.id, item]));
    setCatalog((current) => ({
      ...current,
      trips: [...current.trips, trip],
      conversations: current.conversations.map((item) => restored.get(item.id) ?? item),
    }));
    setDeletedTrip(undefined);
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
      updateAskProgress: (progress: QuestionProgress) =>
        dispatch({ kind: "askProgress", progress }),
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
      openHome: (tripId: string) => layout({ type: "open-home", tripId }),
      selectView: (view: MobileView) => layout({ type: "select-view", view }),
      showChatView: (view: ChatView) => layout({ type: "show-chat-view", view }),
      openFactsSheet: () => layout({ type: "open-sheet" }),
      closeFactsSheet: () => layout({ type: "close-sheet" }),
      openTeamSheet: () => layout({ type: "open-team-sheet" }),
      closeTeamSheet: () => layout({ type: "close-team-sheet" }),
      closePreferences: () => layout({ type: "close-fact" }),
      openTrip: () => layout({ type: "open-trip" }),
      closeTrip: () => layout({ type: "close-trip" }),
      toggleSidebar: () => setSidebarCollapsed((value) => !value),
      resizeSidebar: (width: number | undefined) => setSidebarWidth(width),
      resizeChat: (share: number | undefined) => setChatShare(share),

      showMapDay: (day: number | undefined) => browsingActions.current.setMapDay(day ?? 1),

      pickMapDay: (day: number) => {
        browsingActions.current.setMapDay(day);
        const current = browsingActions.current.plan;
        const selected = current && selectedByTrip.current.get(current.tripId);
        if (
          !selected ||
          !current?.sections.some((section) =>
            section.proposal?.items.some((stop) => stop.id === selected && stop.day === day),
          )
        ) {
          dispatch({ kind: "selected", activity: undefined });
        }
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
      ask,
      previousTotal,
      busy: state.busy,
      activity: state.activity,
      error: state.error,
      errors: state.errors,

      canRetry: state.retry !== undefined,
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
      resend: (index: number, text: string) => !!text.trim() && send(text, index),
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
      homeTripId: surface.tripId,
      mobileView,
      chatView: surface.chatView ?? "conversation",
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
      renameTrip,
      deleteTrip,
      deletedTrip: deletedTrip && { name: deletedTrip.name, undo: undoDeleteTrip },
      activeTripName: activeTrip?.renamed ? activeTrip.title : undefined,
    },
  };
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>;
