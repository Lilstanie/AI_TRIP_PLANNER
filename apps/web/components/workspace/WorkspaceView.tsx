"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TripFactChips } from "../preferences/TripFactChips";
import { ChatPanel } from "../chat/ChatPanel";
import { TripEditor } from "../trip/TripEditor";
import { TripMapCanvas } from "../map/TripMapCanvas";
import { TripPanel, tripStatus } from "../trip/TripPanel";
import { TripPlaceList } from "../trip/TripPlaceList";
import { LocationPrompt } from "../map/LocationPrompt";
import { useUserLocation } from "../map/useUserLocation";
import { Drawer } from "../ui/Drawer";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { SidebarResizer } from "./SidebarResizer";
import { SplitResizer } from "./SplitResizer";
import { ChatsPanel } from "./ChatsPanel";
import { TripsPage } from "./TripsPage";
import { MenuIcon, RouteIcon } from "../ui/icons";
import type { WorkspaceController } from "./useWorkspaceController";
import { WorkspaceDialogs } from "./WorkspaceDialogs";
import { DataModeToggle } from "./DataModeToggle";
import { CurrencyNotice } from "../account/CurrencyNotice";
import { LanguageToggle } from "./LanguageToggle";
import { usePresence, useSegmentIndicator, viewTransition } from "../ui/motion";
import { useLocale } from "../account/LocaleProvider";
import { PhoneTabBar, phonePanelId } from "./PhoneTabBar";
import { PhoneTripTitle } from "./PhoneTripTitle";
import { PhoneMine } from "./PhoneMine";
import { PhoneMapSheet } from "./PhoneMapSheet";
import { usePhoneKeyboard } from "./usePhoneKeyboard";
import { usePhoneTripUpdates } from "./usePhoneTripUpdates";
import { usePhoneBack } from "./usePhoneBack";
import type { MobileView } from "./workspace-helpers";

export function WorkspaceView({ model }: { model: WorkspaceController }) {
  const { t, notice: localizeNotice } = useLocale();
  const {
    plan,
    draft,
    dataMode,
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
    storageError,
    storageEnabled,
    saveState,
    syncStatus,
    openSettings,
    catalog,
    historyQuery,
    preferencesOpen,
    tripOpen,
    tripTab,
    mobileView,
    sidebarCollapsed,
    sidebarWidth,
    chatShare,
    page,
    chatsOpen,
    navOpen,
    narrow,
    phone,
    selectedActivity,
    mapRoutes,
    tripPlaces,
    historyChats,
    historyTrips,
    notice,
    composerAttachments,
    blank,
    tripStops,
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
    setStorageError,
    setStorageEnabled,
    setNotice,
    setHistoryQuery,
    setTripTab,
    setSidebarCollapsed,
    setSidebarWidth,
    setChatShare,
    setSelectedActivity,
    setMapRoutes,
    openPreferences,
    closePreferences,
    openTrip,
    closeTrip,
    openDialog,
    openNav,
    closeDrawer,
    toggleChats,
    edit,
    saveFacts,
    planWith,
    run,
    submit,
    send,
    ask,
    answer,
    dismissAsk,
    onCancel,
    newChat,
    newTrip,
    selectConversation,
    selectTrip,
    renameChat,
    deleteChat,
  } = model;
  const userLocation = useUserLocation();
  const [phoneMapDay, setPhoneMapDay] = useState<number>();
  const [phoneMapFocusRequest, setPhoneMapFocusRequest] = useState(0);
  const selectMapActivity = (id: string) => {
    setSelectedActivity(id);
    if (phone) setPhoneMapFocusRequest((request) => request + 1);
  };
  // A stop selected elsewhere (the Trip tab's itinerary) shows on its own day when Map opens.
  const selectedDay = model.selectedActivity
    ? model.tripPlaces.itinerary.stop(model.selectedActivity)?.day
    : undefined;
  useEffect(() => {
    if (phone && selectedDay !== undefined) setPhoneMapDay(selectedDay);
  }, [phone, selectedDay]);
  const { keyboardOpen } = usePhoneKeyboard(phone);
  const { tripUpdated } = usePhoneTripUpdates(model);
  usePhoneBack(phone);
  const chatsButton = useRef<HTMLButtonElement>(null);
  const chatsSearch = useRef<HTMLInputElement>(null);
  const chatsPanel = useRef<HTMLDivElement>(null);
  const viewSwitch = useRef<HTMLDivElement>(null);
  useSegmentIndicator(viewSwitch, `${narrow}|${page}|${mobileView}`);
  // The backdrop fades out with its drawer instead of vanishing under it.
  const backdrop = usePresence(drawerOpen || undefined, 360);
  // Whole-view swaps (another chat, a trip, the Your trips page) cross-fade.
  const swap =
    <A extends unknown[]>(action: (...args: A) => void) =>
    (...args: A) =>
      viewTransition(() => action(...args));

  // The Chats panel takes focus on its search when it opens, and Escape or a press outside it
  // closes it. Escape hands focus back to the Chats button.
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
      const target = event.target as Node;
      if (chatsPanel.current?.contains(target) || chatsButton.current?.contains(target)) return;
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
      query={historyQuery}
      onQuery={setHistoryQuery}
      chats={historyChats}
      trips={historyTrips}
      onNewChat={swap(newChat)}
      onNewTrip={swap(newTrip)}
      onOpenChat={swap(selectConversation)}
      onOpenTrip={swap(selectTrip)}
      onRenameChat={renameChat}
      onDeleteChat={deleteChat}
      searchRef={searchRef}
    />
  );
  const showTrips = () => viewTransition(model.showTrips);

  const selectView = (view: MobileView) =>
    view !== mobileView && viewTransition(() => model.selectView(view), `to-${view}`);
  // A phone tab's panel: labelled by its tab, and only the selected one is shown.
  const phonePanel = (view: MobileView) =>
    phone
      ? {
          id: phonePanelId(view),
          role: "tabpanel",
          "aria-labelledby": `phone-tab-${view}`,
          hidden: mobileView !== view,
        }
      : {};

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
        page={page}
        chatsOpen={false}
        chatCount={catalog.conversations.length}
        tripCount={catalog.trips.length}
        onChats={() => undefined}
        onTrips={showTrips}
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

  const tripContent = (
    <>
      {plan ? (
        <TripPanel
          plan={plan}
          tab={tripTab}
          onTab={setTripTab}
          onReview={() => openDialog("review")}
          onEdit={edit}
          places={
            <TripPlaceList
              tripPlaces={tripPlaces}
              startDate={plan.brief.dates[0]}
              selected={selectedActivity}
              onSelect={setSelectedActivity}
              plan={plan}
              disabled={busy || editPending}
              onApply={(next) => {
                setPreviousTotal(plan.estTotal);
                setPlan(next);
              }}
              onAdjust={(id) => {
                setSelectedActivity(id);
                setTripTab("timeline");
              }}
            />
          }
          timeline={
            <TripEditor
              plan={plan}
              disabled={busy}
              onPending={setEditPending}
              tripPlaces={tripPlaces}
              selected={selectedActivity}
              onSelect={setSelectedActivity}
              onRoutesChange={setMapRoutes}
              onApply={(next) => {
                setPreviousTotal(plan.estTotal);
                setPlan(next);
              }}
            />
          }
        />
      ) : (
        <div className="trip-drawer-empty">
          <p>
            {phone
              ? t("No trip yet. Plan one in Chat and your itinerary and budget will appear here.")
              : t(
                  "No trip yet. Describe where you want to go in the chat, or add your trip details. Your itinerary and budget will appear here.",
                )}
          </p>
          {phone && (
            <button type="button" onClick={() => selectView("chat")}>
              {t("Plan in Chat")}
            </button>
          )}
          <button type="button" onClick={edit}>
            {t("Add trip details")}
          </button>
        </div>
      )}
    </>
  );

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
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          collapsed={sidebarCollapsed}
          page={page}
          chatsOpen={chatsOpen}
          chatCount={catalog.conversations.length}
          tripCount={catalog.trips.length}
          chatsButton={chatsButton}
          onChats={toggleChats}
          onTrips={showTrips}
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
        <SidebarResizer width={sidebarWidth} onChange={setSidebarWidth} />
      )}
      {page === "trips" ? (
        <div className="workspace-main">
          {narrow && (
            <header className="workspace-topbar workspace-topbar--trips">{menuButton}</header>
          )}
          <main className="workspace-shell workspace-shell--trips">
            <TripsPage
              trips={catalog.trips}
              activeTripId={blank ? undefined : catalog.activeTripId}
              onOpenTrip={swap(selectTrip)}
              onNewTrip={swap(newTrip)}
            />
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
          </main>
        </div>
      ) : (
        <div className="workspace-main">
          <header className="workspace-topbar">
            {menuButton}
            {phone ? (
              <PhoneTripTitle model={model} />
            ) : (
              <div className="topbar-summary">
                <h1 className="topbar-title">{plan ? plan.brief.destination : t("New trip")}</h1>
              </div>
            )}
            <TripFactChips
              draft={draft}
              plan={plan}
              busy={busy || editPending}
              errors={errors}
              open={openFact}
              onOpen={openPreferences}
              onClose={closePreferences}
              onSave={saveFacts}
              onPlan={planWith}
              preferencesChip={preferencesToggle}
              suggestPlaces={dataMode.mode === "live" && !!dataMode.providers?.maps}
            />
            {narrow && !phone && (
              <div
                ref={viewSwitch}
                className="topbar-views segmented"
                role="group"
                aria-label={t("Workspace view")}
              >
                {(["chat", "map"] as const).map((view) => (
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
                <div
                  className="topbar-control-cluster"
                  role="group"
                  aria-label={t("Data and language controls")}
                >
                  <DataModeToggle
                    mode={dataMode.mode}
                    providers={dataMode.providers}
                    onChange={dataMode.choose}
                    disabled={busy}
                  />
                  <LanguageToggle />
                </div>
                <button
                  ref={tripToggle}
                  type="button"
                  className="topbar-button trip-trigger"
                  aria-label={t("Open your trip")}
                  aria-describedby={tripStops ? "trip-trigger-count" : undefined}
                  aria-expanded={tripOpen}
                  aria-haspopup="dialog"
                  onClick={() => (tripOpen ? closeTrip() : openTrip())}
                >
                  <RouteIcon />
                  <span className="topbar-button__label">{t("Trip")}</span>
                  {tripStops > 0 && (
                    <span className="trip-trigger__count" id="trip-trigger-count">
                      {tripStops}
                      <span className="sr-only"> {t(tripStops === 1 ? "stop" : "stops")}</span>
                    </span>
                  )}
                </button>
              </div>
            )}
          </header>
          <div className="workspace-notices">
            <CurrencyNotice />
            {error && (
              <div className="error-banner" role="alert">
                {localizeNotice(error)}{" "}
                {retry && (
                  <button disabled={busy} onClick={() => void run(retry)}>
                    {t("Retry update")}
                  </button>
                )}
              </div>
            )}
            {storageError && (
              <div className="error-banner" role="alert">
                {localizeNotice(storageError)}{" "}
                <button
                  onClick={() => {
                    setStorageError("");
                    setStorageEnabled(true);
                  }}
                >
                  {t("Retry / replace workspace storage")}
                </button>
              </div>
            )}
            {userLocation.asking && (
              <LocationPrompt onAllow={userLocation.allow} onDismiss={userLocation.dismiss} />
            )}
            {notice && (
              <p role="status" className="notice">
                {localizeNotice(notice)}{" "}
                <button onClick={() => setNotice("")} aria-label={t("Dismiss notification")}>
                  {t("Dismiss")}
                </button>
              </p>
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
          >
            <div className="workspace-panel workspace-panel--chat" {...phonePanel("chat")}>
              <ChatPanel
                plan={plan}
                messages={messages}
                input={input}
                onInput={setInput}
                busy={busy}
                locked={editPending}
                activity={activity}
                error={localizeNotice(error)}
                onCancel={onCancel}
                onSend={send}
                ask={ask}
                onAnswer={answer}
                onDismissAsk={dismissAsk}
                onEdit={edit}
                onStart={edit}
                onAttachFiles={composerAttachments.addFiles}
                attachments={composerAttachments.attachments}
                onRemoveAttachment={composerAttachments.removeAttachment}
                canAttach={composerAttachments.canAttach}
                attachNotices={composerAttachments.notices}
              />
            </div>
            {!narrow && <SplitResizer share={chatShare} onChange={setChatShare} />}
            <div className="workspace-panel workspace-panel--map" {...phonePanel("map")}>
              <TripMapCanvas
                destination={plan?.brief.destination}
                viewKey={plan ? `${plan.tripId}|${plan.brief.destination}` : undefined}
                tripPlaces={tripPlaces}
                selectedActivity={selectedActivity}
                onSelectActivity={selectMapActivity}
                routes={mapRoutes}
                focusedDay={phone ? phoneMapDay : undefined}
                focusRequest={phone ? phoneMapFocusRequest : undefined}
                phone={phone}
                showPhotos={dataMode.mode === "live" && !!dataMode.providers?.maps}
                userLocation={userLocation}
              />
              {phone && (
                <PhoneMapSheet
                  model={model}
                  day={phoneMapDay}
                  onDayChange={setPhoneMapDay}
                  onSelectStop={selectMapActivity}
                />
              )}
            </div>
            {phone && (
              <div className="workspace-panel workspace-panel--trip" {...phonePanel("trip")}>
                {plan && (
                  <div className="phone-trip__head">
                    <h2 className="phone-trip__title">{t("Your trip")}</h2>
                    <span className="trip__meta">{t(tripStatus(plan))}</span>
                  </div>
                )}
                {tripContent}
              </div>
            )}
            {phone && (
              <div className="workspace-panel workspace-panel--mine" {...phonePanel("mine")}>
                <PhoneMine model={model} />
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
            {!phone && (
              <Drawer
                side="right"
                open={tripOpen}
                title={t("Your trip")}
                closeLabel={t("Close your trip")}
                onClose={closeTrip}
                returnFocus={tripToggle}
                className="workspace-drawer workspace-drawer--trip"
                meta={plan && <span className="trip__meta">{t(tripStatus(plan))}</span>}
              >
                {tripContent}
              </Drawer>
            )}
          </main>
          {phone && (
            <PhoneTabBar
              view={mobileView}
              onSelect={selectView}
              hidden={keyboardOpen}
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
