import type { AgentProposal, TripBrief } from "@trip/shared";

export interface OutboundArrival {
  day: number;
  time: string;
}

export function outboundArrival(
  brief: Pick<TripBrief, "dates" | "destination">,
  proposals: readonly AgentProposal[],
): OutboundArrival | undefined {
  const flight = proposals
    .find((proposal) => proposal.agent === "transport")
    ?.flights?.find(
      (candidate) =>
        candidate.id === "flight-0" &&
        candidate.depart === brief.dates[0] &&
        candidate.to.trim().toLowerCase() === brief.destination.split("&")[0]?.trim().toLowerCase(),
    );
  const selected = flight?.candidates.find((candidate) => candidate.id === flight.selectedId);
  const match = selected?.outbound?.segments
    .at(-1)
    ?.arrivesAt.match(/^(\d{4}-\d{2}-\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)(?:$|[ :])/);
  if (!match) return undefined;
  const arrived = Date.parse(`${match[1]}T00:00:00Z`);
  const day = (arrived - Date.parse(`${brief.dates[0]}T00:00:00Z`)) / 86400000 + 1;
  if (
    !Number.isInteger(day) ||
    day < 1 ||
    new Date(arrived).toISOString().slice(0, 10) !== match[1]
  )
    return undefined;
  return { day, time: `${match[2]}:${match[3]}` };
}
