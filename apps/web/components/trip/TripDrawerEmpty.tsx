"use client";
import { useLocale } from "../account/LocaleProvider";

export function TripDrawerEmpty({
  phone,
  onPlanInChat,
  onAddDetails,
}: {
  phone: boolean;
  onPlanInChat(): void;
  onAddDetails(): void;
}) {
  const { t } = useLocale();
  return (
    <div className="trip-drawer-empty">
      <p>{phone ? t("noTripYetPlanOne") : t("noTripYetDescribeWhere")}</p>
      <button type="button" onClick={phone ? onPlanInChat : onAddDetails}>
        {phone ? t("planInChat") : t("addTripDetails")}
      </button>
    </div>
  );
}
