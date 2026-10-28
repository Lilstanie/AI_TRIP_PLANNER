"use client";
import { GearIcon } from "../ui/icons";
import { useLocale } from "../account/LocaleProvider";
import { DataModeToggle } from "./DataModeToggle";
import { ChatsPanel } from "./ChatsPanel";
import { TripsPage } from "./TripsPage";
import type { WorkspaceModel } from "./useWorkspace";

export function PhoneMine({ model }: { model: WorkspaceModel }) {
  const { t } = useLocale();
  const { session, history } = model;
  const { dataMode, busy } = session;
  const visibleTrips = new Set(history.trips.map((trip) => trip.id));

  const { newChat, newTrip } = session;
  const openTrip = model.layout.openHome;

  return (
    <div className="phone-mine">
      <ChatsPanel
        collectionActions
        query={history.query}
        onQuery={history.search}
        chats={history.chats}
        trips={history.trips}
        onNewChat={newChat}
        onNewTrip={newTrip}
        onOpenChat={session.selectConversation}
        onOpenTrip={openTrip}
        onRenameChat={history.rename}
        onDeleteChat={history.delete}
        onRenameTrip={history.renameTrip}
        onDeleteTrip={history.deleteTrip}
        deletedTrip={history.deletedTrip}
        tripsContent={
          history.query.trim() && !visibleTrips.size ? (
            <p className="history-empty">{t("No matching trips.")}</p>
          ) : (
            <TripsPage
              embedded
              trips={history.catalog.trips.filter((trip) => visibleTrips.has(trip.id))}
              allTrips={history.catalog.trips}
              activeTripId={history.catalog.activeTripId}
              onOpenTrip={openTrip}
              onNewTrip={newTrip}
              onRenameTrip={history.renameTrip}
              onDeleteTrip={history.deleteTrip}
            />
          )
        }
      />
      <div className="phone-mine__controls" role="group" aria-label={t("Data mode")}>
        <DataModeToggle
          mode={dataMode.mode}
          providers={dataMode.providers}
          onChange={dataMode.choose}
          disabled={busy}
        />
      </div>
      <button
        type="button"
        className="phone-mine__settings"
        onClick={() => model.layout.openSettings()}
      >
        <GearIcon />
        <span>{t("Settings & account")}</span>
      </button>
    </div>
  );
}
