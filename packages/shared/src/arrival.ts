import type { AgentProposal, TripBrief } from "./contracts";

export interface OutboundArrival {
  day: number;
  time: string;
}

export type InboundDeparture = OutboundArrival;

const STAMP = /^(\d{4}-\d{2}-\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)(?:$|[ :])/;

function tripMoment(start: string, stamp: string | undefined): OutboundArrival | undefined {
  const match = stamp?.match(STAMP);
  if (!match) return undefined;
  const at = Date.parse(`${match[1]}T00:00:00Z`);
  const day = (at - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
  if (!Number.isInteger(day) || day < 1 || new Date(at).toISOString().slice(0, 10) !== match[1])
    return undefined;
  return { day, time: `${match[2]}:${match[3]}` };
}

function selectedFirstFlight(brief: Pick<TripBrief, "dates">, proposals: readonly AgentProposal[]) {
  const flight = proposals
    .find((proposal) => proposal.agent === "transport")
    ?.flights?.find(
      (candidate) => candidate.id === "flight-0" && candidate.depart === brief.dates[0],
    );
  return flight && { flight, selected: flight.candidates.find((c) => c.id === flight.selectedId) };
}

export function outboundArrival(
  brief: Pick<TripBrief, "dates" | "destination">,
  proposals: readonly AgentProposal[],
): OutboundArrival | undefined {
  const chosen = selectedFirstFlight(brief, proposals);
  if (
    chosen?.flight.to.trim().toLowerCase() !== brief.destination.split("&")[0]?.trim().toLowerCase()
  )
    return undefined;
  return tripMoment(brief.dates[0], chosen.selected?.outbound?.segments.at(-1)?.arrivesAt);
}

export function inboundDeparture(
  brief: Pick<TripBrief, "dates">,
  proposals: readonly AgentProposal[],
): InboundDeparture | undefined {
  const chosen = selectedFirstFlight(brief, proposals);
  return tripMoment(brief.dates[0], chosen?.selected?.inbound?.segments[0]?.departsAt);
}
