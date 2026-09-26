import type { ReactNode } from "react";
import type { Connection, FixedRow } from "@/lib/trip/timeline";
import { money } from "@/lib/workspace";
import {
  FlowDriveIcon,
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
  const Icon = row.kind === "ground" && /^Drive/.test(row.detail) ? FlowDriveIcon : FIXED_ICON[row.kind];
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
          <span className="sr-only">{FIXED_LABEL[row.kind]}: </span>
          {row.title}
        </p>
        <p className="timeline-row__meta">{row.detail}</p>
      </div>
      <span className="timeline-row__cost">
        {row.cost !== undefined ? money(row.cost) : (row.costNote ?? "Price unknown")}
      </span>
    </li>
  );
}

const CONNECTION_ICON: Record<string, (props: { size?: number }) => ReactNode> = {
  walk: FlowWalkIcon,
  WALK: FlowWalkIcon,
  drive: FlowDriveIcon,
};

/** The journey between two stops, drawn as part of the line rather than as another card. */
export function ConnectionRow({ connection }: { connection: Connection }) {
  const Icon = CONNECTION_ICON[connection.mode] ?? FlowTransitIcon;
  return (
    <li className={`timeline-connection timeline-connection--${connection.status}`}>
      <span className="timeline-row__time" />
      <span className="timeline-connection__rail" aria-hidden="true" />
      <p className="timeline-connection__label">
        <Icon size={13} />
        <span>{connection.label}</span>
        {connection.fare && <span>· {connection.fare}</span>}
        <span className="timeline-connection__status">
          {connection.status === "checked"
            ? "checked"
            : connection.status === "planned"
              ? "estimate"
              : "check failed"}
        </span>
      </p>
    </li>
  );
}
