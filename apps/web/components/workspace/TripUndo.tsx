"use client";
import { useLocale } from "../account/LocaleProvider";

export type DeletedTrip = { name: string; undo(): void };

export function TripUndo({ deleted }: { deleted: DeletedTrip }) {
  const { t } = useLocale();
  return (
    <div className="item-undo trip-undo" role="status">
      <span>{t("Deleted “{name}”. Its chats are kept.", { name: deleted.name })}</span>
      <button type="button" onClick={deleted.undo}>
        {t("Undo")}
      </button>
    </div>
  );
}
