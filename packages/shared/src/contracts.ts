import { z } from "zod";
import { Currency } from "./money";

export const AGENT_NAMES = [
  "itinerary",
  "transport",
  "accommodation",
  "destination-guide",
  "dining",
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export const AccommodationPreferences = z.object({
  roomAllocation: z.enum(["shared", "individual"]).default("shared"),
  minRating: z.number().min(0).max(10).default(0),
  freeCancellation: z.boolean().default(false),
});

export const MAX_TRIP_PREFERENCES = 12;
export const MAX_TRIP_PREFERENCE_LENGTH = 200;
export const TripPreferences = z
  .array(z.string().trim().min(1).max(MAX_TRIP_PREFERENCE_LENGTH))
  .max(MAX_TRIP_PREFERENCES);
export type TripPreferences = z.infer<typeof TripPreferences>;

export const BookedStay = z.object({
  name: z.string().trim().min(1).max(160),
  note: z.string().trim().max(300).optional(),
});
export type BookedStay = z.infer<typeof BookedStay>;

const partyCount = z.number().int().min(0).max(99);
export const TravellerParty = z.object({
  adults: partyCount,
  children: partyCount,
  infants: partyCount,
  seniors: partyCount,
  pets: partyCount,
});
export type TravellerParty = z.infer<typeof TravellerParty>;
export const partyPeople = (party: TravellerParty) =>
  party.adults + party.children + party.infants + party.seniors;
export function isTripDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
  );
}

export const TravelModes = [
  "train",
  "flight",
  "bus",
  "walk",
  "transit",
  "tram",
  "ferry",
  "drive",
  "cycle",
] as const;
export const TravelMode = z.enum(TravelModes);
export type TravelMode = z.infer<typeof TravelMode>;

export const LegModeChoice = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  mode: TravelMode,
});
export type LegModeChoice = z.infer<typeof LegModeChoice>;

export const TripBrief = z
  .object({
    tripId: z.string(),
    userId: z.string().default("demo-user"),
    destination: z.string().trim().min(1),

    origin: z.string().trim().min(1).optional(),
    dates: z.tuple([
      z.string().refine(isTripDate, "Enter a real date"),
      z.string().refine(isTripDate, "Enter a real date"),
    ]),
    groupSize: z.number().int().positive(),

    party: TravellerParty.optional(),
    budgetTotal: z.number().min(0.01),

    budgetSource: z.object({ amount: z.number().positive(), currency: Currency }).optional(),

    displayCurrency: Currency.optional(),
    nationality: z.string().optional(),
    accommodation: AccommodationPreferences.optional(),

    preferences: TripPreferences.optional(),

    learnedPreferences: TripPreferences.optional(),

    excludeFlights: z.boolean().optional(),

    legModes: z.array(LegModeChoice).max(12).optional(),

    bookedStay: BookedStay.optional(),
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

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ArriveBy = z.object({
  mode: TravelMode,
  durationMin: z.number().int().positive(),

  line: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
});
export type ArriveBy = z.infer<typeof ArriveBy>;

export const ProposalItem = z
  .object({
    id: z.string().min(1).optional(),
    placeId: z.string().min(1).optional(),

    savedPlace: z
      .object({
        name: z.string(),
        address: z.string().optional(),
        location: z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
      })
      .optional(),
    priceNeedsReview: z.boolean().optional(),
    kind: z.string(),
    detail: z.string(),
    estCost: z.number().nonnegative().optional(),
    day: z.number().int().optional(),

    startTime: z.string().regex(HHMM, "startTime must be HH:MM (24h)").optional(),
    endTime: z.string().regex(HHMM, "endTime must be HH:MM (24h)").optional(),
    location: z.string().trim().min(1).optional(),

    arriveBy: ArriveBy.optional(),

    selectionId: z.string().min(1).optional(),

    note: z.string().trim().max(500).optional(),

    booked: z.boolean().optional(),
  })

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

export const FlightPlace = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
});
export type FlightPlace = z.infer<typeof FlightPlace>;

export const FlightSegment = z.object({
  from: FlightPlace,
  to: FlightPlace,

  departsAt: z.string().min(1),

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

export const FlightLeg = z.object({
  segments: z.array(FlightSegment).min(1),
  layovers: z.array(FlightLayover).default([]),

  durationMin: z.number().int().positive(),
});
export type FlightLeg = z.infer<typeof FlightLeg>;

export const FlightCandidate = z.object({
  id: z.string().min(1),
  carrier: z.string().min(1),

  price: z.number().nonnegative(),
  stops: z.number().int().nonnegative().optional(),
  durationMin: z.number().int().positive().optional(),
  note: z.string().optional(),

  outbound: FlightLeg.optional(),

  inbound: FlightLeg.optional(),

  roundTrip: z.boolean().optional(),
});
export type FlightCandidate = z.infer<typeof FlightCandidate>;

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

  floorCost: z.number().nonnegative().optional(),
});
export type AgentProposal = z.infer<typeof AgentProposal>;

export const RevisionRequest = z.object({
  tripId: z.string(),
  targetAgent: z.enum(AGENT_NAMES),
  reason: z.string(),
  constraints: z.array(z.string()),

  targetSaving: z.number().nonnegative().optional(),
});
export type RevisionRequest = z.infer<typeof RevisionRequest>;

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
