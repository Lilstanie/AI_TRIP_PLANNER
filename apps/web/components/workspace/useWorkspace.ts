"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceStorage } from "./useWorkspaceStorage";
import { useWorkspaceTransport } from "./useWorkspaceTransport";
import { useTripDay } from "../trip/useTripDay";
import { savedBrowsing, rememberBrowsing, validSelectedStop } from "@/lib/workspace/browsing";
import { useTripPlaces } from "../map/useTripPlaces";
import { effectiveCurrency, type AgentProgressEvent, type TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import type { QuestionProgress } from "@/lib/workspace/ask-user";
import { blankDraft, type Draft } from "@/lib/workspace";
import {
  reusableBlankConversation,
  conversationTitle,
  latestSnapshot,
  tripConversations,
  upsertCurrent,
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
import { isTripAction } from "@/lib/workspace/layout";
import {
  idleSession,
  session as nextSession,
  type SavedSession,
  type SessionEvent,
  type SessionState,
  type Task,
  type TurnOutcome,
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
import type { Notice } from "@/lib/i18n/notice";
import type { Message } from "@/lib/workspace";

type BackgroundTurn = {
  conversationId: string;
  tripId: string;
  task: Task;
  controller: AbortController;
  state: SessionState;
  basePlan: TripPlan | undefined;
  status: "running" | "stopped" | "failed";
  activity: AgentProgressEvent[];
  error?: Notice;
  retry?: Task;
};

const PLAN_CONFLICT: Notice = {
  key: "The plan changed while this reply was being prepared. Your edits were kept.",
};
const planFingerprint = (plan: TripPlan | undefined) =>
  plan === undefined
    ? undefined
    : JSON.stringify(
        {
          tripId: plan.tripId,
          brief: plan.brief,
          editVersion: plan.editVersion ?? 0,
          dayNotes: plan.dayNotes,
          sections: plan.sections.map((section) => ({
            id: section.id,
            proposal: section.proposal
              ? {
                  items: section.proposal.items,
                  stays: section.proposal.stays,
                  flights: section.proposal.flights,
                }
              : undefined,
          })),
        },
        (_key, value: unknown) =>
          value && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
            : value,
      );

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
  const { plan, draft, messages, input, previousTotal, ask, selectedActivity, status } = state;

  const stateRef = useRef(state);
  stateRef.current = state;
  const backgroundTurns = useRef(new Map<string, BackgroundTurn>());
  const tripWriters = useRef(new Map<string, string>());
  const activeConversation = useRef(
    restored.conversationId ?? `conversation:${crypto.randomUUID()}`,
  );
  const [sessionActions] = useState(() => {
    const update = (events: SessionEvent[]) => {
      let next = stateRef.current;
      for (const event of events) next = nextSession(next, event);
      stateRef.current = next;
      setSession(next);
      return next;
    };
    return {
      update,
      dispatch(event: SessionEvent) {
        const next = update([event]);
        if (event.kind !== "opened") {
          const turn = backgroundTurns.current.get(activeConversation.current);
          if (turn) turn.state = next;
        }
        return next;
      },
    };
  });
  const { dispatch, update: updateSession } = sessionActions;
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

  const freshTripId = useRef(crypto.randomUUID());
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
  const {
    storageError,
    storageEnabled,
    saveState,
    setStorageError,
    setStorageEnabled,
    flushSave,
    saveBackground,
  } = useWorkspaceStorage({
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
      for (const turn of backgroundTurns.current.values()) turn.controller.abort();
      backgroundTurns.current.clear();
      tripWriters.current.clear();
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

  function open(saved: SavedSession, conversationId: string) {
    flushSave();
    const previous = backgroundTurns.current.get(activeConversation.current);
    if (previous) previous.state = stateRef.current;
    activeConversation.current = conversationId;
    const turn = backgroundTurns.current.get(conversationId);
    const restored = turn
      ? {
          ...saved,
          plan: saved.plan ?? turn.state.plan,
          draft: saved.plan ? saved.draft : turn.state.draft,
          messages: turn.state.messages,
          input: turn.state.input,
          ask: turn.state.ask,
          previousTotal: saved.plan ? saved.previousTotal : turn.state.previousTotal,
        }
      : saved;
    if (turn) {
      turn.state = {
        ...turn.state,
        plan: restored.plan,
        draft: restored.draft,
        previousTotal: restored.previousTotal,
      };
    }
    const restoredSelection =
      restored.plan &&
      (selectedByTrip.current.has(restored.plan.tripId)
        ? selectedByTrip.current.get(restored.plan.tripId)
        : savedBrowsing(restored.plan).selected);
    updateSession([
      {
        kind: "opened",
        saved: {
          ...restored,
          selectedActivity: validSelectedStop(restored.plan, restoredSelection),
        },
      },
      ...(turn
        ? [
            {
              kind: "taskRestored" as const,
              status: turn.status,
              activity: turn.activity,
              ...(turn.error ? { error: turn.error } : {}),
              ...(turn.retry ? { retry: turn.retry } : {}),
            },
          ]
        : []),
    ]);

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

  function canStart(tripId: string) {
    const turn = backgroundTurns.current.get(activeConversation.current);
    return !tripWriters.current.has(tripId) && turn?.status !== "running";
  }

  function start(
    task: Task,
    controller: AbortController,
    change?: { message: Message; brief?: boolean; rewindIndex?: number },
  ) {
    const conversationId = activeConversation.current;
    if (!canStart(task.request.tripId)) return;
    const basePlan = task.request.plan ?? stateRef.current.plan;
    const events: SessionEvent[] = [
      ...(change?.rewindIndex === undefined
        ? []
        : [{ kind: "rewound" as const, index: change.rewindIndex }]),
      ...(change ? [{ kind: "sent" as const, message: change.message, brief: change.brief }] : []),
      { kind: "started" },
    ];
    const next = updateSession(events);
    const turn: BackgroundTurn = {
      conversationId,
      tripId: task.request.tripId,
      task,
      controller,
      state: next,
      basePlan,
      status: "running",
      activity: next.activity,
    };
    backgroundTurns.current.set(conversationId, turn);
    tripWriters.current.set(task.request.tripId, conversationId);
    return conversationId;
  }

  function progress(conversationId: string, controller: AbortController, event: SessionEvent) {
    const turn = backgroundTurns.current.get(conversationId);
    if (!turn || turn.controller !== controller || turn.status !== "running") return;
    if (event.kind !== "progress") return;
    turn.activity = [...turn.activity, event.event];
    turn.state =
      activeConversation.current === conversationId
        ? updateSession([event])
        : nextSession(turn.state, event);
  }

  function finish(
    conversationId: string,
    controller: AbortController,
    outcome: TurnOutcome,
    _task: Task,
  ) {
    const turn = backgroundTurns.current.get(conversationId);
    if (!turn || turn.controller !== controller || turn.status !== "running") return;

    if (tripWriters.current.get(turn.tripId) === conversationId)
      tripWriters.current.delete(turn.tripId);
    if (outcome.kind === "cancelled") {
      const next =
        activeConversation.current === conversationId
          ? updateSession([outcome])
          : nextSession(turn.state, outcome);
      turn.state = next;
      turn.activity = next.activity;
      turn.status = "stopped";
      saveBackground(conversationId, next, false);
      return;
    }

    const saved = flushSave();
    const savedPlan = saved.trips.find((trip) => trip.id === `trip:${turn.tripId}`)?.snapshot.plan;
    const visiblePlan =
      stateRef.current.plan?.tripId === turn.tripId ? stateRef.current.plan : undefined;
    const latestPlan =
      visiblePlan !== undefined && planFingerprint(visiblePlan) !== planFingerprint(turn.basePlan)
        ? visiblePlan
        : savedPlan;
    const conflict =
      outcome.kind === "planned" && planFingerprint(turn.basePlan) !== planFingerprint(latestPlan);
    const event: SessionEvent = conflict
      ? {
          kind: "planConflict",
          outcome,
          notice: PLAN_CONFLICT,
        }
      : outcome;
    const next =
      activeConversation.current === conversationId
        ? updateSession([
            ...(conflict && latestPlan ? [{ kind: "edited" as const, plan: latestPlan }] : []),
            event,
          ])
        : nextSession(conflict ? { ...turn.state, plan: latestPlan } : turn.state, event);
    turn.state = next;
    turn.activity = next.activity;
    saveBackground(conversationId, next, outcome.kind === "planned" && !conflict);
    if (
      outcome.kind === "planned" &&
      !conflict &&
      activeConversation.current !== conversationId &&
      stateRef.current.plan?.tripId === turn.tripId &&
      next.plan
    )
      updateSession([{ kind: "edited", plan: next.plan }]);

    if (outcome.kind === "failed") {
      turn.status = "failed";
      turn.error = next.error;
      turn.retry = next.retry;
      return;
    }
    backgroundTurns.current.delete(conversationId);
  }

  function cancelActive() {
    const conversationId = activeConversation.current;
    const turn = backgroundTurns.current.get(conversationId);
    if (!turn || turn.status !== "running") return;
    turn.controller.abort();
    tripWriters.current.delete(turn.tripId);
    const next = updateSession([{ kind: "cancelled" }]);
    turn.state = next;
    turn.activity = next.activity;
    turn.status = "stopped";
    saveBackground(conversationId, next, false);
  }

  function abortTurns(keep: (turn: BackgroundTurn) => boolean) {
    for (const [conversationId, turn] of backgroundTurns.current) {
      if (keep(turn)) continue;
      turn.controller.abort();
      backgroundTurns.current.delete(conversationId);
      if (tripWriters.current.get(turn.tripId) === conversationId)
        tripWriters.current.delete(turn.tripId);
    }
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
    canStart,
    start,
    progress,
    finish,
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
  function loadConversation(id: string) {
    const savedCatalog = flushSave();
    const conversation = savedCatalog.conversations.find((item) => item.id === id);
    if (!conversation) return false;
    const source = latestSnapshot(savedCatalog, conversation);
    const keepCurrentPlan =
      plan &&
      source &&
      plan.tripId === source.plan.tripId &&
      (editPending || JSON.stringify(plan) === JSON.stringify(source.plan));
    if (!source) freshTripId.current = crypto.randomUUID();
    open(
      {
        ...(source
          ? { plan: keepCurrentPlan ? plan : source.plan, previousTotal: source.previousTotal }
          : { plan: undefined, previousTotal: undefined }),
        draft: source ? source.draft : (conversation.draft ?? blankDraft()),
        messages: conversation.messages,
        input: conversation.input,
        ask: conversation.ask,
      },
      id,
    );
    setCatalog((current) => {
      const next = updateCatalog(current, {
        activeConversationId: id,
        ...(conversation.tripId ? { activeTripId: conversation.tripId } : {}),
      });
      if (!conversation.tripId) delete next.activeTripId;
      return next;
    });
    return true;
  }
  function selectConversation(id: string) {
    if (!loadConversation(id)) return;
    layout({ type: "chat-opened" });
  }
  function loadTrip(id: string) {
    const savedCatalog = flushSave();
    const trip = savedCatalog.trips.find((item) => item.id === id);
    if (!trip) return false;
    const conversationId = trip.conversationIds.at(-1);
    const conversation = savedCatalog.conversations.find((item) => item.id === conversationId);
    open(
      {
        ...trip.snapshot,
        ...(conversation ? { messages: conversation.messages, input: conversation.input } : {}),
      },
      conversation?.id ?? `conversation:${trip.snapshot.id}`,
    );
    setCatalog((current) =>
      updateCatalog(current, {
        activeTripId: id,
        ...(conversation ? { activeConversationId: conversation.id } : {}),
      }),
    );
    return true;
  }
  function selectTrip(id: string) {
    if (!loadTrip(id)) return;
    layout({ type: "trip-opened" });
  }

  function startTripChat(tripId: string, text: string, navigate = true) {
    const savedCatalog = flushSave();
    const trip = savedCatalog.trips.find((item) => item.id === tripId);
    if (!trip) return undefined;
    const untouched = text
      ? undefined
      : tripConversations(savedCatalog, tripId).find(
          (item) => !item.messages.length && !item.input.trim() && !item.ask,
        );
    if (untouched) {
      if (navigate) selectConversation(untouched.id);
      else loadConversation(untouched.id);
      return untouched.id;
    }
    const id = crypto.randomUUID();
    const snapshot = {
      ...trip.snapshot,
      id,
      savedAt: new Date().toISOString(),
      messages: [],
      input: text,
      ask: undefined,
    };
    open(snapshot, `conversation:${id}`);
    setCatalog((current) => upsertCurrent(current, snapshot));
    if (navigate) layout({ type: "chat-started" });
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLInputElement>(".composer textarea")
        ?.focus({ preventScroll: true }),
    );
    return `conversation:${id}`;
  }
  function startBlankChat(
    base?: WorkspaceCatalog,
    kind: "chat" | "trip" = "chat",
    navigate = true,
  ) {
    const defaults = draftDefaults(settings);
    const id =
      reusableBlankConversation(base ?? catalog, defaults)?.id ??
      `conversation:${crypto.randomUUID()}`;
    open(
      { plan: undefined, previousTotal: undefined, draft: defaults, messages: [], input: "" },
      id,
    );
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

    if (!navigate) return;
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

    abortTurns((turn) => turn.conversationId !== id);
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
    const tripId = id.replace(/^trip:/, "");
    abortTurns((turn) => turn.tripId !== tripId);
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
    if (catalog.activeTripId === id) startBlankChat(next, "chat", surface.page !== "home");
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
      applyEdit: (next: TripPlan) => {
        if (stateRef.current.plan?.tripId !== next.tripId) return;
        dispatch({ kind: "edited", plan: next });
      },
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
      cancel: cancelActive,
    },
    layout: {
      closeDialog: () => layout({ type: "close-dialog" }),
      openNav: () => layout({ type: "open-nav" }),

      closeDrawer: () => layout({ type: "close-drawer" }),
      toggleChats: () => layout({ type: "toggle-chats" }),
      showTrips: () => layout({ type: "show-trips" }),
      openHome: (tripId: string) => layout({ type: "open-home", tripId }),
      openTripAction: (action: import("@/lib/workspace/layout").TripAction) =>
        layout({ type: "open-trip-action", action }),
      closeTripAction: () => layout({ type: "close-trip-action" }),
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
      focusMapDay: (day: number) => {
        stable.layout.pickMapDay(day);
        setMapFocus((request) => request + 1);
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
      status,
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
        if (state.retry) run(state.retry);
      },

      planWith: (next: Draft) => {
        dispatch({ kind: "drafted", draft: next });
        return submit(next);
      },
      selectTrip,
      selectConversation,
      openTripConversation: (id: string) => loadConversation(id),
      previewTrip: (id: string) => loadTrip(id),
      newChat: () => startBlankChat(),
      newTripChat: startTripChat,
      startHomeTripChat: (tripId: string, text: string) => startTripChat(tripId, text, false),

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

      tripAction:
        surface.page === "home" && isTripAction(surface.drawer) ? surface.drawer : undefined,
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
