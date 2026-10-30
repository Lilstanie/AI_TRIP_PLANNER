"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { TripFactChips } from "../preferences/TripFactChips";
import { ChatPanel } from "../chat/ChatPanel";
import { ChatHeaderMenu } from "./ChatHeaderMenu";
import { useTrajectoryFocus } from "../chat/trajectory-focus";
import { TripMapCanvas } from "../map/TripMapCanvas";
import { OpenItemsBadge } from "../trip/OpenItemsBadge";
import { useUserLocation } from "../map/useUserLocation";
import { Drawer } from "../ui/Drawer";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { SidebarResizer } from "./SidebarResizer";
import { SplitResizer } from "./SplitResizer";
import { ChatsPanel } from "./ChatsPanel";
import { TripsPage, type Tab as TripsTab } from "./TripsPage";
import { TripHome } from "./TripHome";
import { TripHomeCards } from "./TripHomeCards";
import { conversationTitle, tripConversations } from "@/lib/workspace/catalog";
import { TripHomeChats, TripHomeComposer } from "./TripHomeChats";
import { TripHomeSuggestion } from "./TripHomeSuggestion";
import { TripHomeMap } from "./TripHomeMap";
import { TripHomeActionHost } from "./TripHomeActionHost";
import { useTripHomeActionPanel } from "./useTripHomeActionPanel";
import { useWorkspaceTripEditor } from "./useWorkspaceTripEditor";
import { distinctTripTitles, tripName } from "@/lib/workspace/trip-identity";
import { MenuIcon, RouteIcon } from "../ui/icons";
import type { WorkspaceModel } from "./useWorkspace";
import { WorkspaceDialogs } from "./WorkspaceDialogs";
import { DataModeToggle } from "./DataModeToggle";
import { CurrencyNotice } from "../account/CurrencyNotice";
import { usePresence, useSegmentIndicator, viewTransition } from "../ui/motion";
import { useLocale } from "../account/LocaleProvider";
import { useSettings } from "../account/SettingsProvider";
import { draftDefaults } from "@/lib/account/settings";
import { isBlankUntouchedChat, showBriefChrome } from "@/lib/workspace/blank-chat";
import { PhoneTabBar, phonePanelId } from "./PhoneTabBar";
import { PhoneTeamButton } from "./PhoneTeamButton";
import { PhoneTripTitle } from "./PhoneTripTitle";
import { TeamControl } from "../chat/TeamControl";
import { latestTurn } from "../chat/team-model";
import { PhoneMine } from "./PhoneMine";
import { PhoneMapSheet } from "./PhoneMapSheet";
import { usePhoneKeyboard } from "./usePhoneKeyboard";
import { usePhoneTripUpdates } from "./usePhoneTripUpdates";
import { usePhoneBack } from "./usePhoneBack";
import type { MobileView } from "./workspace-helpers";
import { dateRangeLabel } from "@/lib/workspace/trip-facts";
import type { TripAction } from "@/lib/workspace/layout";

export function WorkspaceView({ model }: { model: WorkspaceModel }) {
  const { t, locale, delta, notice: localizeNotice } = useLocale();
  const { settings } = useSettings();
  const { session, layout, itinerary, history } = model;
  const [tripView, setTripView] = useState<"itinerary" | "map">("itinerary");
  const {
    plan,
    draft,
    dataMode,
    messages,
    input,
    editPending,
    busy,
    status,
    activity,
    error,
    errors,
    canRetry,
    selectedActivity,
    mapRoutes,
    places: tripPlaces,
    attachments: composerAttachments,
    blank,
    ask,
    estimateChange,
    replacedChange,
  } = session;
  const {
    page,
    homeTripId,
    mobileView,
    preferencesOpen,
    tripOpen,
    sidebarCollapsed,
    sidebarWidth,
    chatShare,
    chatsOpen,
    navOpen,
    tripAction,
    narrow,
    phone,
    drawerOpen,
    openFact,
    preferencesToggle,
    tripToggle,
    navToggle,
    openSettings,
    openPreferences,
    closePreferences,
    openTrip,
    closeTrip,
    openNav,
    closeDrawer,
    toggleChats,
    openTripAction,
    closeTripAction,
    edit,
  } = layout;
  const { catalog, saveState, syncStatus, storageError } = history;
  const userLocation = useUserLocation();
  const { keyboardOpen } = usePhoneKeyboard(phone);
  const { tripUpdated } = usePhoneTripUpdates(model);
  usePhoneBack(phone);
  const { focus: teamFocus } = useTrajectoryFocus();
  const seenFocus = useRef(teamFocus?.nonce ?? 0);
  useEffect(() => {
    if (!teamFocus || teamFocus.nonce === seenFocus.current) return;
    seenFocus.current = teamFocus.nonce;
    if (!phone) layout.showChatView("trajectory");
  }, [teamFocus, phone, layout]);
  const wasPhone = useRef(phone);
  useEffect(() => {
    if (wasPhone.current && !phone && mobileView === "trip") openTrip();
    wasPhone.current = phone;
  }, [phone, mobileView, openTrip]);

  useEffect(() => {
    if (page !== "workspace" || blank || !plan) {
      document.title = "AI Trip Planner";
      return;
    }

    const dates = dateRangeLabel(plan.brief.dates[0], plan.brief.dates[1], locale);
    document.title = [plan.brief.destination, dates, "AI Trip Planner"].filter(Boolean).join(" · ");
  }, [blank, locale, page, plan]);

  const homeTrip =
    page === "home" ? catalog.trips.find((trip) => trip.id === homeTripId) : undefined;
  const homeSnapshot = homeTrip
    ? catalog.activeTripId === homeTrip.id && plan?.tripId === homeTrip.snapshot.plan.tripId
      ? { plan, draft }
      : homeTrip.snapshot
    : undefined;
  const homePlan = homeSnapshot?.plan;
  const currentChat = catalog.conversations.find(
    (chat) => chat.id === catalog.activeConversationId,
  );
  const linkedTrip = catalog.trips.find((trip) => trip.id === currentChat?.tripId);
  const chatHeader = (
    <ChatHeaderMenu
      key={currentChat?.id ?? "new-chat"}
      title={currentChat ? conversationTitle(currentChat, locale) : t("New chat")}
      tripTitle={linkedTrip ? tripName(linkedTrip, t) : undefined}
      siblings={
        linkedTrip
          ? tripConversations(catalog, linkedTrip.id)
              .filter((chat) => chat.id !== currentChat?.id)
              .map((chat) => ({ id: chat.id, title: conversationTitle(chat, locale) }))
          : catalog.conversations
              .filter((chat) => !chat.tripId && chat.id !== currentChat?.id)
              .map((chat) => ({ id: chat.id, title: conversationTitle(chat, locale) }))
      }
      trips={catalog.trips
        .filter((trip) => trip.id !== linkedTrip?.id)
        .map((trip) => ({
          id: trip.id,
          title: tripName(trip, t),
          disabled: session.writingTripIds.includes(trip.snapshot.plan.tripId),
        }))}
      busy={busy || editPending || !!ask}
      trajectory={layout.chatView === "trajectory"}
      onConversation={() => layout.showChatView("conversation")}
      onViewTrip={linkedTrip ? () => openHome(linkedTrip.id) : undefined}
      onSelectChat={session.selectConversation}
      onNewChat={history.newLinkedChat}
      onMoveChat={history.moveChat}
      onNewTrip={history.newTripForChat}
      onRename={() => currentChat && history.rename(currentChat.id)}
      onDelete={() => currentChat && history.delete(currentChat.id)}
    />
  );
  const editorPlan = page === "home" ? homePlan : plan;
  const sessionTripId = plan?.tripId;
  const { previewTrip } = session;
  const sessionOwnsEditor =
    page !== "home" || (!!sessionTripId && sessionTripId === homeTrip?.snapshot.plan.tripId);
  const sendFromTrip = (message: string) => {
    if (!session.send(message)) return;
    layout.selectView("chat");
    layout.showChatView("conversation");
  };
  const { undo, timelineEdits, tripContent } = useWorkspaceTripEditor({
    page,
    editorPlan,
    plan,
    sessionOwnsEditor,
    tripPlaces,
    dataMode,
    locale,
    editPending,
    busy,
    selectedActivity,
    mapRoutes,
    mapDay: layout.mapDay,
    phone,
    narrow,
    onApplyEdit: session.applyEdit,
    onTrackEdit: session.trackEdit,
    onSelectStop: session.selectStop,
    onShowRoutes: session.showRoutes,
    onSetTimelineChanged: session.setTimelineChanged,
    onPickMapDay: layout.pickMapDay,
    onSendFromTrip: sendFromTrip,
    onSelectView: (view) => {
      if (view !== mobileView) viewTransition(() => layout.selectView(view), `to-${view}`);
    },
    onShowTripMap: () => setTripView("map"),
    onEdit: edit,
  });
  const chatsButton = useRef<HTMLButtonElement>(null);
  const chatsSearch = useRef<HTMLInputElement>(null);
  const chatsPanel = useRef<HTMLDivElement>(null);
  const viewSwitch = useRef<HTMLDivElement>(null);
  useSegmentIndicator(viewSwitch, `${narrow}|${page}|${mobileView}|${tripOpen}|${tripView}`);

  const backdrop = usePresence(drawerOpen || undefined, 360);

  const swap =
    <A extends unknown[]>(action: (...args: A) => void) =>
    (...args: A) =>
      viewTransition(() => action(...args));

  useEffect(() => {
    if (!chatsOpen) return;
    chatsSearch.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (
        document.querySelector(
          '.history-item__menu, dialog[open], [role="dialog"][aria-modal="true"]',
        )
      )
        return;
      event.preventDefault();
      closeDrawer();
      chatsButton.current?.focus({ preventScroll: true });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (
        chatsPanel.current?.contains(target) ||
        chatsButton.current?.contains(target) ||
        target.closest?.("dialog[open]")
      )
        return;
      closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [chatsOpen, closeDrawer]);

  const chatsContent = (searchRef?: typeof chatsSearch) => (
    <ChatsPanel
      query={history.query}
      onQuery={history.search}
      chats={history.chats}
      trips={history.trips}
      onNewChat={swap(session.newChat)}
      onNewTrip={swap(session.newTrip)}
      onOpenChat={swap(session.selectConversation)}
      onOpenTrip={openHome}
      onRenameChat={history.rename}
      onDeleteChat={history.delete}
      onRenameTrip={history.renameTrip}
      onDeleteTrip={deleteTrip}
      deletedTrip={history.deletedTrip}
      searchRef={searchRef}
    />
  );
  const [tripsTab, setTripsTab] = useState<TripsTab>("trips");
  const [calendarTripId, setCalendarTripId] = useState<string>();
  const showTrips = () => {
    setTripsTab("trips");
    setCalendarTripId(undefined);
    viewTransition(layout.showTrips);
  };
  const homeAction = useTripHomeActionPanel({
    phone,
    narrow,
    tripAction,
    openTripAction,
    closeTripAction,
    viewTransition,
  });

  const showCalendar = () => {
    setTripsTab("calendar");
    setCalendarTripId(undefined);
    viewTransition(layout.showTrips);
  };
  const openHome = (id: string) => {
    setCalendarTripId(undefined);
    viewTransition(() => {
      layout.openHome(id);
    });
  };
  const leaveHome = useRef(layout.showTrips);
  leaveHome.current = layout.showTrips;
  const homeMissing = page === "home" && !homeTrip;
  useEffect(() => {
    if (homeMissing) leaveHome.current();
  }, [homeMissing]);
  const deleteTrip = history.deleteTrip;
  const toggleTrajectory = () =>
    layout.showChatView(
      page === "workspace" && layout.chatView === "trajectory" ? "conversation" : "trajectory",
    );
  const sidebarPage = page === "home" ? "trips" : page;
  const sidebarTripsView = page === "home" ? "trips" : tripsTab;

  const openHomeChat = session.selectConversation;
  const sendHomeChat = (...args: Parameters<typeof session.sendHomeTripChat>) =>
    !!session.sendHomeTripChat(...args);
  const openHomeAction = (action: TripAction, trigger: HTMLButtonElement) => {
    homeAction.open(action, trigger, () => {
      if (homeTrip && catalog.activeTripId !== homeTrip.id) previewTrip(homeTrip.id);
    });
  };
  const chooseHomeDay = (day: number) => {
    layout.focusMapDay(day);
    openTripAction("itinerary");
  };
  const chooseHomeActivity = (activityId: string, day: number) => {
    const stop = itinerary.stop(activityId);
    if (!stop || stop.day !== day) return;
    layout.focusMapDay(day);
    session.showStop(activityId);
    openTripAction("itinerary");
  };
  const selectView = (view: MobileView) =>
    view !== mobileView && viewTransition(() => layout.selectView(view), `to-${view}`);

  const selectMapStop = (id: string) => {
    const stop = itinerary.stop(id);
    if (stop) layout.pickMapDay(stop.day);
    session.showStop(id);
  };

  useEffect(() => {
    if (!phone || plan || mobileView !== "trip") return;
    layout.selectView("chat");
  }, [phone, plan, mobileView, layout]);

  const teamTurn = latestTurn(activity, busy, messages);
  const profileDefaults = draftDefaults(settings);
  const briefChrome =
    !phone ||
    showBriefChrome({
      messages,
      input,
      draft,
      defaults: profileDefaults,
    });
  const untouched = isBlankUntouchedChat({
    plan,
    messages,
    input,
    draft,
    defaults: profileDefaults,
  });

  const phonePanel = (view: MobileView) =>
    phone
      ? {
          id: phonePanelId(view),
          role: "tabpanel",
          "aria-labelledby": `phone-tab-${view}`,
          hidden: mobileView !== view,
        }
      : {};
  const chatPanel = () => (
    <ChatPanel
      key={history.catalog.activeConversationId ?? "conversation"}
      plan={plan}
      draft={draft}
      messages={messages}
      input={input}
      onInput={session.type}
      busy={busy}
      locked={editPending}
      activity={activity}
      error={error}
      onCancel={session.cancel}
      onSend={session.send}
      onResend={session.resend}
      {...(phone ? { onOpenTrip: () => selectView("trip") } : {})}
      ask={ask}
      onAnswer={session.answer}
      onAskProgress={session.updateAskProgress}
      onDismissAsk={session.dismissAsk}
      onEdit={edit}
      phone={phone}
      showTabs={false}
      blankUntouched={untouched}
      conversationId={history.catalog.activeConversationId}
      view={layout.chatView}
      onViewChange={layout.showChatView}
      onAttachFiles={composerAttachments.addFiles}
      attachments={composerAttachments.attachments}
      onRemoveAttachment={composerAttachments.removeAttachment}
      canAttach={composerAttachments.canAttach}
      attachNotices={composerAttachments.notices}
    />
  );

  const navDrawer = narrow && !phone && (
    <Drawer
      side="left"
      open={navOpen}
      title={t("Navigation")}
      hideTitle
      closeLabel={t("Close navigation")}
      onClose={closeDrawer}
      returnFocus={navToggle}
      className="workspace-drawer workspace-drawer--nav"
    >
      <WorkspaceSidebar
        collapsible={false}
        collapsed={sidebarCollapsed}
        page={sidebarPage}
        chatsOpen={false}
        chatCount={catalog.conversations.length}
        tripCount={catalog.trips.length}
        onTrips={showTrips}
        onCalendar={showCalendar}
        onNewChat={swap(session.newChat)}
        onTrajectory={toggleTrajectory}
        trajectoryOpen={page === "workspace" && layout.chatView === "trajectory"}
        tripsView={sidebarTripsView}
        onSettings={openSettings}
        saveState={saveState}
        syncStatus={syncStatus}
      >
        {chatsContent()}
      </WorkspaceSidebar>
    </Drawer>
  );
  const menuButton = narrow && !phone && (
    <button
      ref={navToggle}
      type="button"
      className="topbar-icon-button"
      aria-label={t("Open navigation")}
      aria-expanded={navOpen}
      aria-haspopup="dialog"
      onClick={openNav}
    >
      <MenuIcon />
    </button>
  );

  const openItems = plan && (
    <OpenItemsBadge
      plan={plan}
      tripPlaces={tripPlaces}
      onSelectStop={session.selectStop}
      onSelectDay={layout.pickMapDay}
    />
  );

  const homeMap = homePlan ? (
    <TripHomeMap
      plan={homePlan}
      mode={dataMode.mode}
      providers={dataMode.providers}
      focusedDay={layout.mapDay}
      focusRequest={layout.mapFocus}
      selectedActivity={selectedActivity}
      onSelectActivity={session.selectStop}
      routes={sessionOwnsEditor ? mapRoutes : []}
    />
  ) : undefined;
  return (
    <div
      className="workspace-app"
      data-sidebar-collapsed={!narrow && sidebarCollapsed}
      data-narrow={narrow}
      data-phone={phone || undefined}
      style={
        !narrow && sidebarWidth !== undefined
          ? ({ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties)
          : undefined
      }
    >
      {!narrow && (
        <WorkspaceSidebar
          onToggleCollapsed={layout.toggleSidebar}
          collapsed={sidebarCollapsed}
          page={sidebarPage}
          chatsOpen={chatsOpen}
          chatCount={catalog.conversations.length}
          tripCount={catalog.trips.length}
          chatsButton={chatsButton}
          onChats={toggleChats}
          onTrips={showTrips}
          onCalendar={showCalendar}
          onNewChat={swap(session.newChat)}
          onTrajectory={toggleTrajectory}
          trajectoryOpen={page === "workspace" && layout.chatView === "trajectory"}
          tripsView={sidebarTripsView}
          onSettings={openSettings}
          saveState={saveState}
          syncStatus={syncStatus}
        />
      )}
      {!narrow && (
        <div
          ref={chatsPanel}
          id="chats-panel"
          className={`chats-panel${chatsOpen ? " is-open" : ""}`}
          role="region"
          aria-label={t("Chats")}
          inert={!chatsOpen}
        >
          {chatsContent(chatsSearch)}
        </div>
      )}
      {!narrow && !sidebarCollapsed && (
        <SidebarResizer width={sidebarWidth} onChange={layout.resizeSidebar} />
      )}
      {page !== "workspace" ? (
        <div className="workspace-main">
          {narrow && !phone && (
            <header className="workspace-topbar workspace-topbar--trips">{menuButton}</header>
          )}
          <main
            className="workspace-shell workspace-shell--trips"
            data-home-action-expanded={homeAction.expanded ? "true" : undefined}
          >
            {homeTrip ? (
              <TripHome
                phone={phone}
                aside={!!homePlan}
                mainRef={homeAction.mainRef}
                title={distinctTripTitles(catalog.trips, (trip) => tripName(trip, t)).get(
                  homeTrip.id,
                )!}
                key={homeTrip.id}
                facts={{
                  phone,
                  view: mobileView,
                  draft: homeSnapshot!.draft,
                  plan: homePlan,
                  busy: busy || editPending,
                  errors,
                  open: openFact,
                  onOpen: (fact) => {
                    if (catalog.activeTripId !== homeTrip.id) previewTrip(homeTrip.id);
                    openPreferences(fact);
                  },
                  onClose: closePreferences,
                  onSave: session.saveFacts,
                  onPlan: session.planWith,
                  preferencesChip: preferencesToggle,
                  suggestPlaces: dataMode.mode === "live" && !!dataMode.providers?.maps,
                }}
                onBack={() => viewTransition(layout.showTrips)}
                onRename={() => history.renameTrip(homeTrip.id)}
                onDelete={() => deleteTrip(homeTrip.id)}
                actions={
                  homePlan ? (
                    <TripHomeCards
                      plan={homePlan}
                      draft={homeSnapshot!.draft}
                      onOpen={openHomeAction}
                    />
                  ) : undefined
                }
                suggestion={
                  homePlan ? (
                    <TripHomeSuggestion
                      tripId={homeTrip.id}
                      plan={homePlan}
                      onChoose={(text) => void sendHomeChat(homeTrip.id, text)}
                    />
                  ) : undefined
                }
                map={homeMap}
                composer={
                  <TripHomeComposer
                    disabled={
                      session.writingTripIds.includes(homeTrip.snapshot.plan.tripId) || editPending
                    }
                    onSend={(text, attachments) => sendHomeChat(homeTrip.id, text, attachments)}
                  />
                }
              >
                <TripHomeChats
                  chats={tripConversations(catalog, homeTrip.id).map((item) => ({
                    id: item.id,
                    title: conversationTitle(item, locale),
                    updatedAt: item.updatedAt,
                  }))}
                  onOpen={openHomeChat}
                />
              </TripHome>
            ) : (
              <TripsPage
                tab={tripsTab}
                onTab={setTripsTab}
                focusTripId={calendarTripId}
                trips={catalog.trips}
                activeTripId={blank ? undefined : catalog.activeTripId}
                onOpenTrip={openHome}
                onNewTrip={swap(session.newTrip)}
                onRenameTrip={history.renameTrip}
                onDeleteTrip={deleteTrip}
                deletedTrip={history.deletedTrip}
              />
            )}
            {navOpen && (
              <button
                type="button"
                tabIndex={-1}
                className="workspace-drawer-backdrop"
                aria-label={t("Close open panel")}
                onClick={() => {
                  closeDrawer();
                  navToggle.current?.focus({ preventScroll: true });
                }}
              />
            )}
            {navDrawer}
            {homePlan && (
              <TripHomeActionHost
                action={tripAction}
                plan={homePlan}
                draft={homeSnapshot!.draft}
                selectedDay={layout.mapDay}
                busy={busy || editPending || timelineEdits.busy}
                errors={errors}
                editErrors={timelineEdits.errors}
                showEditNotice={!!timelineEdits.undo}
                onUndo={() => {
                  if (timelineEdits.undo)
                    void timelineEdits.edit(timelineEdits.undo).then((done) => {
                      if (done) undo.clear();
                    });
                }}
                onSave={session.saveFacts}
                onReplan={session.planWith}
                onSchedule={(idea, day) =>
                  idea.id
                    ? timelineEdits.edit({ kind: "schedule", id: idea.id, day }, (_, next) =>
                        undo.record(next, { operation: { kind: "idea", id: idea.id! } }),
                      )
                    : false
                }
                onClose={homeAction.close}
                onSwitch={homeAction.switchTo}
                onSelectDay={chooseHomeDay}
                onSelectActivity={chooseHomeActivity}
                selectedActivity={selectedActivity}
                returnFocus={homeAction.returnFocus}
                expanded={homeAction.expanded}
                itinerary={
                  catalog.activeTripId === homeTripId && plan?.tripId === homePlan.tripId
                    ? tripContent
                    : null
                }
              />
            )}
          </main>
        </div>
      ) : (
        <div className="workspace-main">
          <header className="workspace-topbar">
            {menuButton}
            {phone ? (
              <>
                <PhoneTripTitle
                  model={model}
                  chatHeader={mobileView === "chat" ? chatHeader : undefined}
                />
                <PhoneTeamButton model={model} turn={teamTurn} />
              </>
            ) : (
              <div className="topbar-leading">
                {chatHeader}
                <TeamControl
                  turn={teamTurn}
                  {...(narrow ? { onReveal: () => layout.selectView("chat") } : {})}
                />
              </div>
            )}
            {((briefChrome && (phone || !linkedTrip || tripOpen)) || openFact) && (
              <TripFactChips
                phone={phone}
                view={mobileView}
                draft={draft}
                plan={plan}
                busy={busy || editPending}
                errors={errors}
                open={openFact}
                onOpen={openPreferences}
                onClose={closePreferences}
                onSave={session.saveFacts}
                onPlan={session.planWith}
                preferencesChip={preferencesToggle}
                suggestPlaces={dataMode.mode === "live" && !!dataMode.providers?.maps}
              />
            )}
            {narrow && !phone && (
              <div
                ref={viewSwitch}
                className="topbar-views segmented"
                role="group"
                aria-label={t(tripOpen ? "Trip views" : "Workspace view")}
              >
                {tripOpen
                  ? (["itinerary", "map"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        aria-pressed={tripView === view}
                        onClick={() => setTripView(view)}
                      >
                        {t(view === "itinerary" ? "Itinerary" : "Map")}
                      </button>
                    ))
                  : (["chat", "map"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        aria-pressed={mobileView === view}
                        onClick={() => selectView(view)}
                      >
                        {t(view === "chat" ? "Chat" : "Map")}
                      </button>
                    ))}
              </div>
            )}
            {!phone && (
              <div className="topbar-actions">
                <div className="topbar-control-cluster" role="group" aria-label={t("Data mode")}>
                  <DataModeToggle
                    mode={dataMode.mode}
                    providers={dataMode.providers}
                    onChange={dataMode.choose}
                    disabled={busy}
                    liveAvailable={dataMode.liveAvailable}
                    liveBlock={dataMode.liveBlock}
                  />
                </div>
                {plan && (
                  <button
                    ref={tripToggle}
                    type="button"
                    className="topbar-button trip-trigger"
                    aria-label={t("Open your trip")}
                    aria-expanded={tripOpen}
                    onClick={() => (tripOpen ? closeTrip() : openTrip())}
                  >
                    <RouteIcon />
                    <span className="topbar-button__label">{t("Trip")}</span>
                  </button>
                )}
              </div>
            )}
          </header>
          <div className="workspace-notices">
            <CurrencyNotice />
            {estimateChange !== undefined && (
              <div className="estimate-notice" role="status">
                <span>
                  {Math.abs(estimateChange) < 0.005
                    ? t("Estimate unchanged from the previous plan.")
                    : t("Estimate changed by {change} from the previous plan.", {
                        change: delta(estimateChange),
                      })}
                </span>
                <button type="button" onClick={session.dismissEstimate}>
                  {t("Dismiss")}
                </button>
              </div>
            )}
            {replacedChange && (
              <div className="replaced-notice" role="status">
                <span>{t("The new plan replaced your last change to the timeline.")}</span>
                <button type="button" onClick={session.dismissReplaced}>
                  {t("Dismiss")}
                </button>
              </div>
            )}
            {status === "stopped" && (
              <div className="error-banner" role="status">
                {t("Planning stopped.")}
              </div>
            )}
            {error && (
              <div className="error-banner" role="alert">
                {localizeNotice(error)}{" "}
                {canRetry && (
                  <button disabled={busy} onClick={session.retry}>
                    {t("Retry update")}
                  </button>
                )}
              </div>
            )}
            {storageError && (
              <div className="error-banner" role="alert">
                {localizeNotice(storageError)}{" "}
                <button onClick={history.retryStorage}>
                  {t("Retry / replace workspace storage")}
                </button>
              </div>
            )}
          </div>
          <main
            className="workspace-shell"
            style={
              !narrow && chatShare !== undefined
                ? ({ "--chat-share": String(chatShare) } as CSSProperties)
                : undefined
            }
            aria-busy={busy}
            data-preferences-open={preferencesOpen}
            data-trip-open={tripOpen}
            data-mobile-view={mobileView}
            data-map={plan ? "shown" : "hidden"}
          >
            {tripOpen && !phone ? (
              <section
                className="trip-workspace"
                aria-label={t("Your trip")}
                data-day={layout.mapDay}
                data-view={tripView}
              >
                <div
                  className="trip-workspace__timeline"
                  hidden={narrow && tripView !== "itinerary"}
                >
                  <div className="trip-workspace__open-items">{openItems}</div>
                  {tripContent}
                </div>
                <div className="trip-workspace__map" hidden={narrow && tripView !== "map"}>
                  <TripMapCanvas
                    destination={plan?.brief.destination}
                    viewKey={plan ? `${plan.tripId}|${plan.brief.destination}` : undefined}
                    tripPlaces={tripPlaces}
                    selectedActivity={selectedActivity}
                    onSelectActivity={selectMapStop}
                    routes={mapRoutes}
                    focusedDay={layout.mapDay}
                    focusRequest={layout.mapFocus}
                    visible={!narrow || tripView === "map"}
                    showPhotos={dataMode.mode === "live" && !!dataMode.providers?.maps}
                    userLocation={userLocation}
                  />
                </div>
              </section>
            ) : (
              <>
                <div className="workspace-panel workspace-panel--chat" {...phonePanel("chat")}>
                  {chatPanel()}
                </div>
                {!narrow && <SplitResizer share={chatShare} onChange={layout.resizeChat} />}
                <div className="workspace-panel workspace-panel--map" {...phonePanel("map")}>
                  <TripMapCanvas
                    destination={plan?.brief.destination}
                    viewKey={plan ? `${plan.tripId}|${plan.brief.destination}` : undefined}
                    tripPlaces={tripPlaces}
                    selectedActivity={selectedActivity}
                    onSelectActivity={session.showStop}
                    routes={mapRoutes}
                    focusedDay={phone ? layout.mapDay : undefined}
                    focusRequest={phone ? layout.mapFocus : undefined}
                    phone={phone}
                    onOpenChat={phone ? () => selectView("chat") : undefined}
                    visible={!narrow || mobileView === "map"}
                    showPhotos={dataMode.mode === "live" && !!dataMode.providers?.maps}
                    userLocation={userLocation}
                  />
                  {phone && <PhoneMapSheet model={model} />}
                </div>
                <div className="workspace-panel workspace-panel--trip" {...phonePanel("trip")}>
                  {phone && plan && (
                    <div className="phone-trip__head">
                      <h2 className="phone-trip__title">{t("Your trip")}</h2>
                      {openItems}
                    </div>
                  )}
                  <Drawer
                    side="right"
                    open={phone || tripOpen}
                    embedded={phone}
                    title={t("Your trip")}
                    closeLabel={t("Close your trip")}
                    onClose={closeTrip}
                    returnFocus={tripToggle}
                    className={
                      phone ? "phone-trip-surface" : "workspace-drawer workspace-drawer--trip"
                    }
                  >
                    {tripContent}
                  </Drawer>
                </div>
                {phone && (
                  <div className="workspace-panel workspace-panel--mine" {...phonePanel("mine")}>
                    <PhoneMine
                      model={model}
                      tripsTab={tripsTab}
                      onTripsTab={setTripsTab}
                      calendarTripId={calendarTripId}
                    />
                  </div>
                )}
                {backdrop.value && (
                  <button
                    type="button"
                    tabIndex={-1}
                    className="workspace-drawer-backdrop"
                    data-leaving={backdrop.leaving || undefined}
                    aria-hidden={backdrop.leaving || undefined}
                    aria-label={t("Close open panel")}
                    onClick={() => {
                      const trigger = tripOpen ? tripToggle : navToggle;
                      closeDrawer();
                      trigger.current?.focus({ preventScroll: true });
                    }}
                  />
                )}
                {navDrawer}
              </>
            )}
          </main>
          {phone && (
            <PhoneTabBar
              view={mobileView}
              onSelect={selectView}
              hidden={keyboardOpen}
              showTrip={Boolean(plan)}
              badges={{
                trip: tripUpdated && <span className="phone-tabbar__dot" aria-hidden="true" />,
              }}
            />
          )}
        </div>
      )}
      <WorkspaceDialogs model={model} />
    </div>
  );
}
