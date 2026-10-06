"use client";
import { GearIcon } from "../ui/icons";
import { useLocale } from "../account/LocaleProvider";
import { DataModeToggle } from "./DataModeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { ChatsPanel } from "./ChatsPanel";
import { TripsPage } from "./TripsPage";
import type { WorkspaceModel } from "./useWorkspace";

/** The phone history and account hub, reusing desktop history and calendar controls. */
export function PhoneMine({ model }: { model: WorkspaceModel }) {
  const { t } = useLocale();
  const { session, history } = model;
  const { dataMode, busy } = session;
  const visibleTrips = new Set(history.trips.map((trip) => trip.id));
  // Opening or starting a chat or trip returns to Chat; the workspace decides that.
  const { newChat, newTrip, selectTrip: openTrip } = session;

  return (
    <div className="phone-mine">
      <ChatsPanel
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
        tripsContent={
          history.query.trim() && !visibleTrips.size ? (
            <p className="history-empty">{t("No matching trips.")}</p>
          ) : (
            <TripsPage
              embedded
              trips={history.catalog.trips.filter((trip) => visibleTrips.has(trip.id))}
              activeTripId={history.catalog.activeTripId}
              onOpenTrip={openTrip}
              onNewTrip={newTrip}
            />
          )
        }
      />
      <div
        className="phone-mine__controls"
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
