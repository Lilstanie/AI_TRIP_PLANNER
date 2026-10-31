"use client";
import type { ReactNode } from "react";
import type { Connection, FixedRow } from "@/lib/trip/timeline";
import type { LegMode } from "@/lib/trip/leg-routes";
import type { MessageKey } from "@/lib/i18n/locale";
import { useLocale } from "../../account/LocaleProvider";
import {
  FlowDriveIcon,
  FlowCycleIcon,
  FlowFlightIcon,
  FlowStayIcon,
  FlowTransitIcon,
  FlowWalkIcon,
} from "../../ui/flow-icons";

const FIXED_ICON = {
  flight: FlowFlightIcon,
  ground: FlowTransitIcon,
  stay: FlowStayIcon,
} as const;

const FIXED_LABEL = { flight: "flight", ground: "transfer", stay: "stay" } as const;

export function FixedTimelineRow({ row }: { row: FixedRow }) {
  const { t, money } = useLocale();
  const Icon = row.kind === "ground" && row.mode === "drive" ? FlowDriveIcon : FIXED_ICON[row.kind];
  return (
    <li className={`timeline-row timeline-fixed timeline-fixed--${row.kind}`}>
      <span className="timeline-row__time">
        {row.startTime ? (
          <>
            {row.startTime}
            <span className="timeline-row__end">{row.endTime}</span>
          </>
        ) : null}
      </span>
      <span className="timeline-row__node timeline-fixed__icon" aria-hidden="true">
        <Icon size={14} />
      </span>
      <div className="timeline-fixed__body">
        <p className="timeline-fixed__title">
          <span className="sr-only">{t(FIXED_LABEL[row.kind])}: </span>
          {row.title}
        </p>
        <p className="timeline-row__meta">{row.detail}</p>
      </div>
      <span className="timeline-row__cost">
        {row.cost !== undefined ? money(row.cost) : (row.costNote ?? t("priceUnknown"))}
      </span>
    </li>
  );
}

const CONNECTION_ICON: Record<string, (props: { size?: number }) => ReactNode> = {
  walk: FlowWalkIcon,
  WALK: FlowWalkIcon,
  drive: FlowDriveIcon,
  DRIVE: FlowDriveIcon,
  cycle: FlowCycleIcon,
  BICYCLE: FlowCycleIcon,
};

const LEG_CHOICES: { mode: LegMode; label: MessageKey }[] = [
  { mode: "walk", label: "walk" },
  { mode: "transit", label: "publicTransport" },
  { mode: "drive", label: "drive" },
  { mode: "cycle", label: "cycle" },
];

export function LegRow({
  connection,
  from,
  to,
  locked = false,
  directions,
  onChoose,
}: {
  connection: Connection;
  directions?: string;

  from: string;
  to: string;
  locked?: boolean;

  onChoose?(mode: LegMode): void;
}) {
  const { t } = useLocale();
  const Icon = CONNECTION_ICON[connection.mode] ?? FlowTransitIcon;
  return (
    <li className={`timeline-connection timeline-connection--${connection.status}`}>
      <span className="timeline-row__time" />
      <span className="timeline-connection__rail" aria-hidden="true" />
      <div className="timeline-connection__body">
        <p className="timeline-connection__label">
          <Icon size={13} />
          <span>{connection.label}</span>
          {connection.fare && <span>· {connection.fare}</span>}
          {connection.service && (
            <span>
              ·{" "}
              {connection.service === "Transitous" ? (
                <a href="https://transitous.org/sources/" target="_blank" rel="noreferrer">
                  Transitous
                </a>
              ) : (
                connection.service
              )}
            </span>
          )}
          {connection.distance && (
            <span className="timeline-connection__distance">· {connection.distance}</span>
          )}
          {connection.status !== "failed" && (
            <span className="timeline-connection__status">
              {connection.status === "checked" ? t("checked") : t("estimate")}
            </span>
          )}
        </p>
        {directions && (
          <a
            className="timeline-connection__directions"
            href={directions}
            target="_blank"
            rel="noreferrer"
            aria-label={t("directionsFromFromToTo", { from, to })}
          >
            {t("directions")}
          </a>
        )}
        {onChoose && (
          <select
            className="timeline-connection__mode"
            aria-label={t("travelFromFromToTo", { from, to })}
            value={connection.choice ?? ""}
            disabled={locked}
            onChange={(event) => onChoose(event.target.value as LegMode)}
          >
            {connection.choice === undefined && (
              <option value="" disabled>
                {t("notCheckedYet")}
              </option>
            )}
            {LEG_CHOICES.map((choice) => (
              <option key={choice.mode} value={choice.mode}>
                {t(choice.label)}
              </option>
            ))}
          </select>
        )}
      </div>
    </li>
  );
}
