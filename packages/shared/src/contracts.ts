import { z } from "zod";
import { Currency } from "./money";

// ---------------------------------------------------------------------------
// The five specialist agents. `name` is the stable id used as the section id
// in the trip plan; keep this list and @trip/agents `allSpecialists` in sync.
// ---------------------------------------------------------------------------
export const AGENT_NAMES = [
  "itinerary",
  "transport",
  "accommodation",
  "destination-guide",
  "dining",
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

// ---------------------------------------------------------------------------
// TripBrief — the structured request the Orchestrator hands to every agent.
// Every field here is reference data the agents plan against.
// ---------------------------------------------------------------------------
export const AccommodationPreferences = z.object({
  roomAllocation: z.enum(["shared", "individual"]).default("shared"),
  minRating: z.number().min(0).max(10).default(0),
  freeCancellation: z.boolean().default(false),
});
export function isTripDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
  );
}
export const TripBrief = z
  .object({
    tripId: z.string(),
    userId: z.string().default("demo-user"),
    destination: z.string().trim().min(1),
    // Where the trip departs from. Optional: briefs saved before this field
    // existed still parse, and a traveller who never states it just gets no
    // long-haul leg priced rather than a guessed one.
    origin: z.string().trim().min(1).optional(),
    dates: z.tuple([
      z.string().refine(isTripDate, "Enter a real date"),
      z.string().refine(isTripDate, "Enter a real date"),
    ]), // [start, end] ISO date
    groupSize: z.number().int().positive(),
    budgetTotal: z.number().min(0.01), // always BASE_CURRENCY; see ./money
    // What the traveller actually said, kept only so the UI can show "A$630
    // (≈ ¥3,000)". Absent means they stated the budget in the base currency, so
    // there is nothing to explain. Optional on purpose: every brief saved before
    // this field existed still parses.
    budgetSource: z.object({ amount: z.number().positive(), currency: Currency }).optional(),
    nationality: z.string().optional(),
    accommodation: AccommodationPreferences.optional(),
  })
  .check((ctx) => {
    const [start, end] = ctx.value.dates;
    if (isTripDate(start) && isTripDate(end)) {
      const nights = (Date.parse(end) - Date.parse(start)) / 86400000;
      const cities = ctx.value.destination.split("&").map((city) => city.trim());
      if (nights <= 0 || cities.some((city) => !city) || nights < cities.length) {
        ctx.issues.push({
          code: "custom",
          input: ctx.value,
          path: ["dates"],
          message: "End date must follow start date, with at least one night per destination.",
        });
      }
    }
  });
export type TripBrief = z.infer<typeof TripBrief>;

// ---------------------------------------------------------------------------
// AgentProposal — what every specialist agent returns for one round.
// The `estCost` rule (currency = AUD, whole trip not per-person) is frozen by A.
// ---------------------------------------------------------------------------
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * How a journey is made. Lives here rather than beside the ports that return
 * it, because a proposal item names one too and contracts cannot import ports.
 */
export const TravelModes = [
  "train",
  "flight",
  "bus",
  "walk",
  "transit",
  "tram",
  "ferry",
  "drive",
] as const;
export const TravelMode = z.enum(TravelModes);
export type TravelMode = z.infer<typeof TravelMode>;

/**
 * How the traveller reaches this item from the one before it.
 *
 * The planner already looks this up to check the day fits; keeping it means
 * the itinerary can say "45 minutes on bus 333" instead of leaving a silent
 * gap between two activities and only speaking up when they collide.
 */
export const ArriveBy = z.object({
  mode: TravelMode,
  durationMin: z.number().int().positive(),
  /** The service taken, when the provider named one: "333", "T1". */
  line: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
});
export type ArriveBy = z.infer<typeof ArriveBy>;

export const ProposalItem = z
  .object({
    id: z.string().min(1).optional(),
    placeId: z.string().min(1).optional(),
    priceNeedsReview: z.boolean().optional(),
    kind: z.string(), // "transport" | "hotel" | "activity" | "meal" | "note" ...
    detail: z.string(),
    estCost: z.number().nonnegative().optional(),
    day: z.number().int().optional(),
    // Optional schedule metadata: lets the orchestrator detect cross-agent time
    // conflicts without parsing human-readable `detail` strings.
    startTime: z.string().regex(HHMM, "startTime must be HH:MM (24h)").optional(),
    endTime: z.string().regex(HHMM, "endTime must be HH:MM (24h)").optional(),
    location: z.string().trim().min(1).optional(),
    /** The connection into this item from the previous one on the same day. */
    arriveBy: ArriveBy.optional(),
  })
  // `.check()` (Zod 4's superRefine) keeps this a plain object, so B/C/D/E can
  // still `.extend()` / `.pick()` it. Three cross-field rules:
  .check((ctx) => {
    const { day, startTime, endTime } = ctx.value;
    if (Boolean(startTime) !== Boolean(endTime)) {
      ctx.issues.push({
        code: "custom",
        message: "startTime and endTime must be provided together",
        input: ctx.value,
        path: [startTime ? "endTime" : "startTime"],
      });
    } else if (startTime && endTime && startTime >= endTime) {
      ctx.issues.push({
        code: "custom",
        message: "endTime must be after startTime on the same day",
        input: ctx.value,
        path: ["endTime"],
      });
    }
    if (startTime && day === undefined) {
      ctx.issues.push({
        code: "custom",
        message: "day must be provided when startTime/endTime are set",
        input: ctx.value,
        path: ["day"],
      });
    }
  });
export type ProposalItem = z.infer<typeof ProposalItem>;

export const StayCandidate = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  area: z.string(),
  pricePerNight: z.number().positive(),
  rating: z.number().min(0).max(10),
  freeCancellation: z.boolean(),
  // true only for a real property from a grounded provider (e.g. Google
  // Places, SerpApi); absent/false for a fictional mock fixture. In mock and
  // Google-Places mode pricePerNight is a planning estimate, never a live
  // quote; SerpApi mode is the one path with a real live rate — see
  // AgentProposal.source for the human-readable disclosure.
  grounded: z.boolean().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  detailsUrl: z.string().url().optional(),
});
export const StaySelection = z.object({
  id: z.string().min(1),
  city: z.string().min(1),
  checkIn: z.string().refine(isTripDate),
  checkOut: z.string().refine(isTripDate),
  day: z.number().int().positive(),
  nights: z.number().int().positive(),
  rooms: z.number().int().positive(),
  selectedId: z.string().min(1),
  candidates: z.array(StayCandidate).min(1),
});
export type StaySelection = z.infer<typeof StaySelection>;
/** An airport as a provider names it: the code people read, and the full name. */
export const FlightPlace = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
});
export type FlightPlace = z.infer<typeof FlightPlace>;

/**
 * One aircraft between two airports.
 *
 * Times are local to each airport and kept as the provider's own strings.
 * Converting them to instants would need each airport's zone, and showing a
 * departure in anything but the departure airport's local time is wrong on a
 * boarding pass and wrong here.
 */
export const FlightSegment = z.object({
  from: FlightPlace,
  to: FlightPlace,
  /** Local departure, "YYYY-MM-DD HH:mm" at `from`. */
  departsAt: z.string().min(1),
  /** Local arrival, "YYYY-MM-DD HH:mm" at `to`. */
  arrivesAt: z.string().min(1),
  durationMin: z.number().int().positive(),
  airline: z.string().min(1),
  airlineLogo: z.string().url().optional(),
  flightNumber: z.string().min(1),
  aircraft: z.string().optional(),
  cabin: z.string().optional(),
});
export type FlightSegment = z.infer<typeof FlightSegment>;

export const FlightLayover = z.object({
  place: FlightPlace,
  durationMin: z.number().int().positive(),
});
export type FlightLayover = z.infer<typeof FlightLayover>;

/** One direction of a journey: the aircraft taken, and the waits between them. */
export const FlightLeg = z.object({
  segments: z.array(FlightSegment).min(1),
  layovers: z.array(FlightLayover).default([]),
  /** Gate to gate including layovers. */
  durationMin: z.number().int().positive(),
});
export type FlightLeg = z.infer<typeof FlightLeg>;

/** One fare a provider offered for a hop, as the traveller would compare them. */
export const FlightCandidate = z.object({
  id: z.string().min(1),
  carrier: z.string().min(1),
  /** Whole-party total in BASE_CURRENCY; see ./money. */
  price: z.number().nonnegative(),
  stops: z.number().int().nonnegative().optional(),
  durationMin: z.number().int().positive().optional(),
  note: z.string().optional(),
  /** The flights themselves, when the provider described them. */
  outbound: FlightLeg.optional(),
  /**
   * The way home. Absent on a one-way fare, and absent on a round trip whose
   * return flights were not looked up — Google Flights returns the outbound
   * options first and needs a second search per itinerary for its returns, so
   * a fare can carry a round-trip price with no inbound leg to show yet.
   */
  inbound: FlightLeg.optional(),
  /** Round trip when a return date was searched, whether or not `inbound` is filled. */
  roundTrip: z.boolean().optional(),
});
export type FlightCandidate = z.infer<typeof FlightCandidate>;

/**
 * The fare chosen for one flown hop, with the ones it beat.
 *
 * Mirrors StaySelection because the traveller's question is the same — "why
 * this one?" — and the transcript can only answer it if the alternatives
 * survive the choice instead of being dropped where it was made.
 */
export const FlightSelection = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  depart: z.string().refine(isTripDate),
  day: z.number().int().positive(),
  passengers: z.number().int().positive(),
  selectedId: z.string().min(1),
  candidates: z.array(FlightCandidate).min(1),
});
export type FlightSelection = z.infer<typeof FlightSelection>;

export const AgentProposalSourceKind = z.enum([
  "live",
  "estimated",
  "mock",
  "fallback",
  "unavailable",
]);
export type AgentProposalSourceKind = z.infer<typeof AgentProposalSourceKind>;
export const AgentProposalSource = z.object({
  kind: AgentProposalSourceKind,
  label: z.string(),
  freshness: z.string(),
});
export type AgentProposalSource = z.infer<typeof AgentProposalSource>;
export const AgentProposal = z.object({
  agent: z.enum(AGENT_NAMES),
  summary: z.string(),
  items: z.array(ProposalItem),
  assumptions: z.array(z.string()),
  conflictsWith: z.array(z.string()).default([]),
  stays: z.array(StaySelection).optional(),
  flights: z.array(FlightSelection).optional(),
  source: AgentProposalSource.optional(),
});
export type AgentProposal = z.infer<typeof AgentProposal>;

// ---------------------------------------------------------------------------
// RevisionRequest — Orchestrator -> a single agent, rounds 2..K.
// ---------------------------------------------------------------------------
export const RevisionRequest = z.object({
  tripId: z.string(),
  targetAgent: z.enum(AGENT_NAMES),
  reason: z.string(), // "over budget by 18%", "day 2 route infeasible" ...
  constraints: z.array(z.string()),
});
export type RevisionRequest = z.infer<typeof RevisionRequest>;

// ---------------------------------------------------------------------------
// Memory records (owned by @trip/services/memory).
// ---------------------------------------------------------------------------
export const ChatTurn = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  at: z.string().default(() => new Date().toISOString()),
});
export type ChatTurn = z.infer<typeof ChatTurn>;

export const UserPreference = z.object({
  key: z.string(),
  value: z.string(),
  source: z.enum(["filter", "chat_confirmed"]),
});
export type UserPreference = z.infer<typeof UserPreference>;
