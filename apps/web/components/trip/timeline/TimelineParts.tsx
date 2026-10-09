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

const FIXED_LABEL = { flight: "Flight", ground: "Transfer", stay: "Stay" } as const;

/** A flight, inter-city hop or stay: part of the day, but changed through the chat, not here. */
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
        {row.cost !== undefined ? money(row.cost) : (row.costNote ?? t("Price unknown"))}
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

/** The modes a traveller can choose for a leg, in the order the control lists them. */
const LEG_CHOICES: { mode: LegMode; label: MessageKey }[] = [
  { mode: "walk", label: "Walk" },
  { mode: "transit", label: "Public transport" },
  { mode: "drive", label: "Drive" },
  { mode: "cycle", label: "Cycle" },
];

/**
 * The journey between two stops, drawn as part of the line rather than as another card. When both
 * stops have saved places the leg has a mode control: changing it routes this leg alone, and a leg
 * whose stops are not both saved yet shows only its estimate.
 */
export function LegRow({
  connection,
  from,
  to,
  locked = false,
  onChoose,
}: {
  connection: Connection;
  /** The stop the leg starts from and the stop it reaches, for the control's name. */
  from: string;
  to: string;
  locked?: boolean;
  /** Routes the leg with the chosen mode; absent while the leg cannot be routed. */
  onChoose?(mode: LegMode): void;
}) {
  const { t } = useLocale();
  const Icon = CONNECTION_ICON[connection.mode] ?? FlowTransitIcon;
  return (
    // Keyed by status in the parent, so a journey that becomes checked mounts again and draws in.
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
          {connection.status !== "failed" && (
            <span className="timeline-connection__status">
              {connection.status === "checked" ? t("checked") : t("estimate")}
            </span>
          )}
        </p>
        {onChoose && (
          <select
            className="timeline-connection__mode"
            aria-label={t("Travel from {from} to {to} by", { from, to })}
            value={connection.choice ?? ""}
            disabled={locked}
            onChange={(event) => onChoose(event.target.value as LegMode)}
          >
            {connection.choice === undefined && (
              <option value="" disabled>
                {t("Not checked yet")}
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
