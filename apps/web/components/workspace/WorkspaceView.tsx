"use client";
import type { CSSProperties } from "react";
import { FiltersPanel } from "../preferences/FiltersPanel";
import { ChatPanel } from "../chat/ChatPanel";
import { TripEditor } from "../trip/TripEditor";
import { TripMapCanvas } from "../map/TripMapCanvas";
import { TripPanel, tripStatus } from "../trip/TripPanel";
import { Drawer } from "../ui/Drawer";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { SidebarResizer } from "./SidebarResizer";
import { MenuIcon, RouteIcon, SlidersIcon } from "../ui/icons";
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
    ask,
    answer,
    dismissAsk,
    onCancel,
    newChat,
    selectConversation,
    selectTrip,
    renameChat,
    deleteChat,
  } = model;

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
          section={section}
          onSection={setSection}
          query={historyQuery}
          onQuery={setHistoryQuery}
          chats={historyChats}
          trips={historyTrips}
          savedCount={saved.length}
          onNewChat={newChat}
          onOpenChat={selectConversation}
          onOpenTrip={selectTrip}
          onRenameChat={renameChat}
          onDeleteChat={deleteChat}
          onSavedTrips={() => openDialog("saved")}
          onLanguage={() => openDialog("language")}
          onAccount={() => openDialog("account")}
          saveState={saveState}
        />
      )}
      {!narrow && !sidebarCollapsed && (
        <SidebarResizer width={sidebarWidth} onChange={setSidebarWidth} />
      )}
      <div className="workspace-main">
        <header className="workspace-topbar">
          {narrow && (
            <button
              ref={navToggle}
              type="button"
              className="topbar-icon-button"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setPreferencesOpen(false);
                setTripOpen(false);
                setNavOpen(true);
              }}
            >
              <MenuIcon />
            </button>
          )}
          <div className="topbar-summary">
            <h1 className="topbar-title">{plan ? plan.brief.destination : "New trip"}</h1>
            <p className="topbar-facts">
              {plan ? facts.join(" · ") : "Not planned yet — add a destination and dates"}
            </p>
          </div>
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
              ref={preferencesToggle}
              type="button"
              className="topbar-button"
              aria-label="Open trip preferences"
              aria-expanded={preferencesOpen}
              aria-haspopup="dialog"
              onClick={() => (preferencesOpen ? closePreferences() : openPreferences())}
            >
              <SlidersIcon />
              <span className="topbar-button__label">Preferences</span>
            </button>
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
          <div className="workspace-panel workspace-panel--map">
            <TripMapCanvas
              destination={plan?.brief.destination}
              viewKey={plan ? `${plan.tripId}|${plan.brief.destination}` : undefined}
              tripPlaces={tripPlaces}
              selectedActivity={selectedActivity}
              onSelectActivity={setSelectedActivity}
              routes={mapRoutes}
            />
          </div>
          {drawerOpen && (
            <button
              type="button"
              tabIndex={-1}
              className="workspace-drawer-backdrop"
              aria-label="Close open panel"
              onClick={() => {
                const trigger = tripOpen
                  ? tripToggle
                  : preferencesOpen
                    ? preferencesToggle
                    : navToggle;
                closePreferences();
                closeTrip();
                setNavOpen(false);
                trigger.current?.focus({ preventScroll: true });
              }}
            />
          )}
          {narrow && (
            <Drawer
              side="left"
              open={navOpen}
              title="Chats and trips"
              closeLabel="Close navigation"
              onClose={() => setNavOpen(false)}
              returnFocus={navToggle}
              className="workspace-drawer workspace-drawer--nav"
            >
              <WorkspaceSidebar
                collapsible={false}
                collapsed={sidebarCollapsed}
                section={section}
                onSection={setSection}
                query={historyQuery}
                onQuery={setHistoryQuery}
                chats={historyChats}
                trips={historyTrips}
                savedCount={saved.length}
                onNewChat={newChat}
                onOpenChat={selectConversation}
                onOpenTrip={selectTrip}
                onRenameChat={renameChat}
                onDeleteChat={deleteChat}
                onSavedTrips={() => openDialog("saved")}
                onLanguage={() => openDialog("language")}
                onAccount={() => openDialog("account")}
                saveState={saveState}
              />
            </Drawer>
          )}
          <Drawer
            side="left"
            open={preferencesOpen}
            title="Trip preferences"
            closeLabel="Close trip preferences"
            onClose={closePreferences}
            returnFocus={preferencesToggle}
            className="workspace-drawer workspace-drawer--preferences"
          >
            <div ref={left} className="filter-container">
              <FiltersPanel
                draft={draft}
                onChange={setDraft}
                onSubmit={submit}
                busy={busy || editPending}
                errors={errors}
              />
            </div>
          </Drawer>
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
                busy={busy || editPending}
                tab={tripTab}
                onTab={setTripTab}
                onReview={() => setDialog("review")}
                onEdit={edit}
                onSave={save}
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
                  No trip yet. Describe where you want to go in the chat, or add your trip details.
                  Your itinerary and budget will appear here.
                </p>
                <button type="button" onClick={edit}>
                  Add trip details
                </button>
              </div>
            )}
          </Drawer>
        </main>
      </div>
      <WorkspaceDialogs model={model} />
    </div>
  );
}
