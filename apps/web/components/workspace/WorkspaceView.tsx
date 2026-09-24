"use client";
import { useEffect, useRef, type CSSProperties } from "react";
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

export function WorkspaceView({ model }: { model: WorkspaceController }) {
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
    setChatShare,
    setPage,
    setChatsOpen,
    setNavOpen,
    setSelectedActivity,
    setMapRoutes,
    openPreferences,
    closePreferences,
    openTrip,
    closeTrip,
    openDialog,
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
  const chatsButton = useRef<HTMLButtonElement>(null);
  const chatsSearch = useRef<HTMLInputElement>(null);
  const chatsPanel = useRef<HTMLDivElement>(null);

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
      setChatsOpen(false);
      chatsButton.current?.focus({ preventScroll: true });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (chatsPanel.current?.contains(target) || chatsButton.current?.contains(target)) return;
      setChatsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [chatsOpen, setChatsOpen]);

  const chatsContent = (searchRef?: typeof chatsSearch) => (
    <ChatsPanel
      query={historyQuery}
      onQuery={setHistoryQuery}
      chats={historyChats}
      trips={historyTrips}
      onNewChat={newChat}
      onNewTrip={newTrip}
      onOpenChat={selectConversation}
      onOpenTrip={selectTrip}
      onRenameChat={renameChat}
      onDeleteChat={deleteChat}
      searchRef={searchRef}
    />
  );
  const showTrips = () => {
    setChatsOpen(false);
    setNavOpen(false);
    closePreferences();
    setTripOpen(false);
    setPage("trips");
  };

  const navDrawer = narrow && (
    <Drawer
      side="left"
      open={navOpen}
      title="Navigation"
      hideTitle
      closeLabel="Close navigation"
      onClose={() => setNavOpen(false)}
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
        onLanguage={() => openDialog("language")}
        onAccount={() => openDialog("account")}
        saveState={saveState}
      >
        {chatsContent()}
      </WorkspaceSidebar>
    </Drawer>
  );
  const menuButton = narrow && (
    <button
      ref={navToggle}
      type="button"
      className="topbar-icon-button"
      aria-label="Open navigation"
      aria-expanded={navOpen}
      aria-haspopup="dialog"
      onClick={() => {
        closePreferences();
        setTripOpen(false);
        setNavOpen(true);
      }}
    >
      <MenuIcon />
    </button>
  );

  return (
    <div
      className="workspace-app"
      data-sidebar-collapsed={!narrow && sidebarCollapsed}
      data-narrow={narrow}
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
          onChats={() => setChatsOpen((open) => !open)}
          onTrips={showTrips}
          onLanguage={() => openDialog("language")}
          onAccount={() => openDialog("account")}
          saveState={saveState}
        />
      )}
      {!narrow && (
        <div
          ref={chatsPanel}
          id="chats-panel"
          className={`chats-panel${chatsOpen ? " is-open" : ""}`}
          role="region"
          aria-label="Chats"
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
              onOpenTrip={selectTrip}
              onNewTrip={newTrip}
            />
            {navOpen && (
              <button
                type="button"
                tabIndex={-1}
                className="workspace-drawer-backdrop"
                aria-label="Close open panel"
                onClick={() => {
                  setNavOpen(false);
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
            <div className="topbar-summary">
              <h1 className="topbar-title">{plan ? plan.brief.destination : "New trip"}</h1>
            </div>
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
            {narrow && (
              <div className="topbar-views" role="group" aria-label="Workspace view">
                {(["chat", "map"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={mobileView === view}
                    onClick={() => setMobileView(view)}
                  >
                    {view === "chat" ? "Chat" : "Map"}
                  </button>
                ))}
              </div>
            )}
            <div className="topbar-actions">
              <DataModeToggle
                mode={dataMode.mode}
                providers={dataMode.providers}
                onChange={dataMode.choose}
                disabled={busy}
              />
              <button
                ref={tripToggle}
                type="button"
                className="topbar-button trip-trigger"
                aria-label="Open your trip"
                aria-describedby={pending ? "trip-trigger-count" : undefined}
                aria-expanded={tripOpen}
                aria-haspopup="dialog"
                onClick={() => (tripOpen ? closeTrip() : openTrip())}
              >
                <RouteIcon />
                <span className="topbar-button__label">Trip</span>
                {pending > 0 && (
                  <span className="trip-trigger__count" id="trip-trigger-count">
                    {pending}
                    <span className="sr-only"> unresolved conflicts</span>
                  </span>
                )}
              </button>
            </div>
          </header>
          <div className="workspace-notices">
            {error && (
              <div className="error-banner" role="alert">
                {error}{" "}
                {retry && (
                  <button disabled={busy} onClick={() => void run(retry)}>
                    Retry update
                  </button>
                )}
              </div>
            )}
            {storageError && (
              <div className="error-banner" role="alert">
                {storageError}{" "}
                <button
                  onClick={() => {
                    setStorageError("");
                    setStorageEnabled(true);
                  }}
                >
                  Retry / replace workspace storage
                </button>
              </div>
            )}
            {userLocation.asking && (
              <LocationPrompt onAllow={userLocation.allow} onDismiss={userLocation.dismiss} />
            )}
            {notice && (
              <p role="status" className="notice">
                {notice}{" "}
                <button onClick={() => setNotice("")} aria-label="Dismiss notification">
                  Dismiss
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
            <div className="workspace-panel workspace-panel--chat">
              <ChatPanel
                plan={plan}
                messages={messages}
                input={input}
                onInput={setInput}
                busy={busy || editPending}
                activity={activity}
                error={error}
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
                attachNotice={composerAttachments.notice}
              />
            </div>
            {!narrow && <SplitResizer share={chatShare} onChange={setChatShare} />}
            <div className="workspace-panel workspace-panel--map">
              <TripMapCanvas
                destination={plan?.brief.destination}
                viewKey={plan ? `${plan.tripId}|${plan.brief.destination}` : undefined}
                tripPlaces={tripPlaces}
                selectedActivity={selectedActivity}
                onSelectActivity={setSelectedActivity}
                routes={mapRoutes}
                showPhotos={dataMode.mode === "live" && !!dataMode.providers?.maps}
                userLocation={userLocation}
              />
            </div>
            {drawerOpen && (
              <button
                type="button"
                tabIndex={-1}
                className="workspace-drawer-backdrop"
                aria-label="Close open panel"
                onClick={() => {
                  const trigger = tripOpen ? tripToggle : navToggle;
                  closeTrip();
                  setNavOpen(false);
                  trigger.current?.focus({ preventScroll: true });
                }}
              />
            )}
            {navDrawer}
            <Drawer
              side="right"
              open={tripOpen}
              title="Your trip"
              closeLabel="Close your trip"
              onClose={closeTrip}
              returnFocus={tripToggle}
              className="workspace-drawer workspace-drawer--trip"
              meta={plan && <span className="trip__meta">{tripStatus(plan)}</span>}
            >
              {plan ? (
                <TripPanel
                  plan={plan}
                  tab={tripTab}
                  onTab={setTripTab}
                  onReview={() => setDialog("review")}
                  onEdit={edit}
                  places={
                    <TripPlaceList
                      tripPlaces={tripPlaces}
                      startDate={plan.brief.dates[0]}
                      selected={selectedActivity}
                      onSelect={setSelectedActivity}
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
                    No trip yet. Describe where you want to go in the chat, or add your trip
                    details. Your itinerary and budget will appear here.
                  </p>
                  <button type="button" onClick={edit}>
                    Add trip details
                  </button>
                </div>
              )}
            </Drawer>
          </main>
        </div>
      )}
      <WorkspaceDialogs model={model} />
    </div>
  );
}
