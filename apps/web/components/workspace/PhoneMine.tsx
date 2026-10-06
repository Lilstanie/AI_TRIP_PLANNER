"use client";
import { GearIcon } from "../ui/icons";
import { useLocale } from "../account/LocaleProvider";
import { DataModeToggle } from "./DataModeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { ChatsPanel } from "./ChatsPanel";
import { TripsPage } from "./TripsPage";
import type { WorkspaceController } from "./useWorkspaceController";

/** The phone history and account hub, reusing desktop history and calendar controls. */
export function PhoneMine({ model }: { model: WorkspaceController }) {
  const { t } = useLocale();
  const { dataMode, busy, openSettings } = model;
  const visibleTrips = new Set(model.historyTrips.map((trip) => trip.id));
  const open =
    <T,>(action: (value: T) => void) =>
    (value: T) => {
      action(value);
      model.setPage("workspace");
      model.setMobileView("chat");
      model.setNavOpen(false);
      model.setChatsOpen(false);
    };
  const newChat = () => open(model.newChat)(undefined);
  const newTrip = () => open(model.newTrip)(undefined);
  const openTrip = open(model.selectTrip);

  return (
    <div className="phone-mine">
      <ChatsPanel
        query={model.historyQuery}
        onQuery={model.setHistoryQuery}
        chats={model.historyChats}
        trips={model.historyTrips}
        onNewChat={newChat}
        onNewTrip={newTrip}
        onOpenChat={open(model.selectConversation)}
        onOpenTrip={openTrip}
        onRenameChat={model.renameChat}
        onDeleteChat={model.deleteChat}
        tripsContent={
          model.historyQuery.trim() && !visibleTrips.size ? (
            <p className="history-empty">{t("No matching trips.")}</p>
          ) : (
            <TripsPage
              embedded
              trips={model.catalog.trips.filter((trip) => visibleTrips.has(trip.id))}
              activeTripId={model.catalog.activeTripId}
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
      <button type="button" className="phone-mine__settings" onClick={() => openSettings()}>
        <GearIcon />
        <span>{t("Settings & account")}</span>
      </button>
    </div>
  );
}
