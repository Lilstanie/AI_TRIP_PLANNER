import {
  TripBrief as TripBriefSchema,
  type AgentContext,
  type AgentProposal,
  type Place,
  type RevisionRequest,
  type Specialist,
  type TripBrief,
  type UserPreference,
  type BudgetAllocation,
  type PlanningBoard,
  type StaySelection,
  type InterfaceLanguage,
  type TripPace,
  TRIP_PACES,
} from "@trip/shared";
import { z } from "zod/v4";
import { createAgent, tool } from "langchain";
import { createRoutedChatModel, readStructuredResponse } from "../models";
import { dateForDay, planningDays } from "../transport/validation";
import { connectionKey, placeCoordinates, travelConflicts, type Connections } from "./travel";
import { cities, cityForDay, scheduledHops } from "../transport/legs";
import { avoidBlockedWindows } from "./revision";
import { mealsByCityFrom, withGrounded, withMeals } from "./meals";
import { dietaryPreferencesForBrief } from "../dining";
import {
  arrivalSlots,
  beforeLanding,
  landingFor,
  landingNote,
  minutes,
  type Landing,
} from "./landing";
import {
  TIME,
  activityFitsTransferWindows,
  transferWindowsByDay,
  type TransferSegment,
  type TransferWindow,
} from "./transfer-windows";
import { mockEnabled } from "@trip/tools";
import { rememberedPlanningPreferences, rankPlacesByInterests } from "../remembered-preferences";
import { TRAVELLER_PREFERENCES_RULE } from "../prompts/traveller-preferences";
import { replyLanguageRule } from "../prompts/reply-language";
import { summaryCopy } from "../summary-copy";

const MODEL_ACTIVITY_BUDGET_SHARE = 0.4;

const ItineraryActivity = z.object({
  day: z.number().int().positive(),
  startTime: z.string().regex(TIME),
  endTime: z.string().regex(TIME),
  location: z.string().trim().min(1),
  detail: z.string().trim().min(1),

  estCost: z.number().nonnegative().optional(),
});

const ItineraryDraft = z.object({
  summary: z.string().trim().min(1),
  activities: z.array(ItineraryActivity),
  assumptions: z.array(z.string().trim().min(1)),
});

export type ItineraryDraft = z.infer<typeof ItineraryDraft>;

export interface ItineraryGenerator {
  generate(input: {
    brief: TripBrief;
    days: number;
    places: Place[];
    preferences: UserPreference[];
    revision?: RevisionRequest;

    feedback?: string;
    rejectedDraft?: string[];

    activityBudget: number;

    pace?: { name: TripPace; activities: string };

    otherSections?: { agent: string; summary: string; items: string[] }[];

    dayCities?: {
      day: number;
      cities: string[];
      transfers?: TransferSegment[];
    }[];
    candidatesByCity?: Record<string, string[]>;

    previous?: { summary: string; activities: string[] };
    language?: InterfaceLanguage;
    arrival?: Landing;
    schedule?: { day: number; travelling?: true; earliestStart?: string }[];
    restaurantsByCity?: Record<string, string[]>;
  }): Promise<ItineraryDraft>;
}

export type { TransferSegment };

export interface ItineraryAgentOptions {
  generator?: ItineraryGenerator | false;
}

export function citiesByDay(
  destination: string,
  days: number,
  transport?: AgentProposal,
): string[][] {
  const names = cities(destination);
  const byDay = cityForDay(names, days).map((city) => [city]);
  const hops = scheduledHops(destination, transport);
  if (!hops.length) return byDay;
  let current = names[0]!;
  return byDay.map((_, index) => {
    const day = index + 1;
    const hop = hops.find((candidate) => candidate.day === day);
    if (hop) {
      current = hop.to;
      return [hop.from, hop.to];
    }
    return [current];
  });
}

function citiesForStayNights(
  brief: TripBrief,
  days: number,
  stays: StaySelection[],
  fallback: string[][],
  transferWindows: ReadonlyMap<number, TransferWindow[]>,
): string[][] {
  const knownCities = cities(brief.destination);
  const scheduled = stays
    .flatMap((stay) => {
      const city = knownCities.find(
        (candidate) => candidate.toLocaleLowerCase() === stay.city.trim().toLocaleLowerCase(),
      );
      return city ? [{ ...stay, city }] : [];
    })
    .sort((left, right) => left.checkIn.localeCompare(right.checkIn));

  let currentCity: string | undefined = knownCities[0];
  let locationSource: "fallback" | "stay" | "transfer" = "fallback";
  return Array.from({ length: days }, (_, index) => {
    const date = dateForDay(brief.dates[0], index + 1);
    const stay = scheduled.find(({ checkIn, checkOut }) => checkIn <= date && date < checkOut);
    const transfers = transferWindows.get(index + 1) ?? [];
    if (!currentCity) return [];
    if (!transfers.length) {
      if (stay) {
        if (locationSource === "transfer" && currentCity !== stay.city) {
          currentCity = undefined;
          return [];
        }
        currentCity = stay.city;
        if (locationSource !== "transfer") locationSource = "stay";
      } else if (locationSource === "fallback") {
        currentCity = fallback[index]?.at(-1) ?? currentCity;
      }
      return [currentCity];
    }
    const timed = transfers.every(({ startTime, endTime }) => startTime && endTime);
    const remaining = [...transfers];
    const ordered: TransferWindow[] = [];
    while (remaining.length) {
      const candidates = remaining.filter(({ from }) => from === currentCity);
      if (candidates.length !== 1) {
        currentCity = undefined;
        return [];
      }
      const [transfer] = candidates;
      if (
        ordered.length &&
        timed &&
        minutes(transfer.startTime!) < minutes(ordered.at(-1)!.endTime!)
      ) {
        currentCity = undefined;
        return [];
      }
      ordered.push(transfer);
      remaining.splice(remaining.indexOf(transfer), 1);
      currentCity = transfer.to;
    }
    locationSource = "transfer";
    const transferCities = [...new Set(ordered.flatMap(({ from, to }) => [from, to]))];
    if (!stay) return transferCities;
    if (currentCity !== stay.city) {
      currentCity = undefined;
      return [];
    }
    return transferCities;
  });
}

function validateDraft(
  draft: ItineraryDraft,
  days: number,
  places: Place[],
  dayCities?: string[][],
  placesByCity?: ReadonlyMap<string, readonly Place[]>,
  transferWindows: ReadonlyMap<number, TransferWindow[]> = new Map(),
  requireEveryDay = true,
  landing?: Landing,
): ItineraryDraft {
  const parsed = ItineraryDraft.parse(draft);
  for (const activity of parsed.activities) {
    if (beforeLanding(activity, landing)) {
      throw new Error(
        `Day ${activity.day} activity ${activity.location} starts before the flight lands on day ${landing!.day} at ${landing!.time}; move it to ${landing!.earliestStart ? `day ${landing!.day} at ${landing!.earliestStart} or later` : `day ${landing!.day + 1} or later`} instead of dropping it.`,
      );
    }
  }

  if (dayCities && placesByCity) {
    const cityOf = new Map<string, string[]>();
    for (const [city, found] of placesByCity)
      for (const place of found) {
        const key = place.name.trim().toLocaleLowerCase();
        cityOf.set(key, [...(cityOf.get(key) ?? []), city]);
      }
    for (const activity of parsed.activities) {
      const allowed = dayCities[activity.day - 1] ?? [];
      const found = cityOf.get(activity.location.trim().toLocaleLowerCase()) ?? [];
      if (found.length) {
        const windows = transferWindows.get(activity.day) ?? [];
        const compatible = found.some((city) => {
          if (!allowed.includes(city)) return false;
          return activityFitsTransferWindows(activity, city, windows);
        });
        if (!compatible) {
          throw new Error(
            `Day ${activity.day} activity ${activity.location} is outside its overnight city or overlaps a scheduled transfer.`,
          );
        }
      }
    }
  }
  const candidates = new Set(places.map((place) => place.name.trim().toLocaleLowerCase()));
  const representedDays = new Set<number>();
  for (const activity of parsed.activities) {
    if (!candidates.has(activity.location.trim().toLocaleLowerCase())) {
      throw new Error(`Itinerary returned an ungrounded location: ${activity.location}`);
    }
    if (activity.day > days) throw new Error(`Itinerary day ${activity.day} exceeds trip length.`);
    if (minutes(activity.endTime) <= minutes(activity.startTime)) {
      throw new Error(`Itinerary activity on day ${activity.day} must end after it starts.`);
    }
    representedDays.add(activity.day);
  }

  const seen = new Set<string>();
  for (const activity of parsed.activities) {
    const key = `${activity.day}|${activity.location.trim().toLocaleLowerCase()}`;
    if (seen.has(key)) {
      throw new Error(
        `Itinerary repeats ${activity.location} on day ${activity.day}; make it one longer activity or pick another place.`,
      );
    }
    seen.add(key);
  }
  const firstFreeDay = landing ? landing.day + 1 : 1;
  const missingDays = Array.from(
    { length: Math.max(0, days - firstFreeDay + 1) },
    (_, index) => firstFreeDay + index,
  ).filter((day) => !representedDays.has(day));
  if (requireEveryDay && missingDays.length)
    throw new Error(
      `Itinerary must include every trip day: day ${missingDays.join(", ")} ${missingDays.length > 1 ? "have" : "has"} no activities. Add activities on ${missingDays.length > 1 ? "those days" : "that day"} and keep the other days as they are${landing ? `; plan nothing before day ${landing.day}${landing.earliestStart ? ` at ${landing.earliestStart}` : ""}, while the traveller is still flying` : ""}.`,
    );
  for (let day = 1; day <= days; day += 1) {
    const scheduled = parsed.activities
      .filter((activity) => activity.day === day)
      .sort((left, right) => minutes(left.startTime) - minutes(right.startTime));
    for (let index = 1; index < scheduled.length; index += 1) {
      if (minutes(scheduled[index]!.startTime) < minutes(scheduled[index - 1]!.endTime)) {
        throw new Error(`Itinerary activities overlap on day ${day}.`);
      }
    }
  }
  return parsed;
}

function isGenericPlace(place: Place, near: string, destination: string): boolean {
  const name = place.name.trim().toLocaleLowerCase();
  return [near, destination, place.category, `${place.category}s`, "neighborhood", "neighbourhood"]
    .map((value) => value.trim().toLocaleLowerCase())
    .includes(name);
}

const DAY_SLOTS = [
  { startTime: "09:30", endTime: "12:00" },
  { startTime: "14:00", endTime: "16:30" },
] as const;

const SINGLE_SLOT = { startTime: "13:00", endTime: "16:00" } as const;

const PACKED_SLOTS = [
  { startTime: "08:30", endTime: "10:00" },
  { startTime: "10:45", endTime: "12:00" },
  { startTime: "14:30", endTime: "15:45" },
  { startTime: "16:30", endTime: "17:45" },
] as const;

const PACE_MAX: Record<TripPace, number> = { relaxed: 2, balanced: 3, packed: 6 };

function sightsByDay(draft: ItineraryDraft, restaurants: Set<string>) {
  const byDay = new Map<number, ItineraryDraft["activities"]>();
  for (const item of draft.activities)
    if (!restaurants.has(item.location.trim().toLowerCase()))
      byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
  return byDay;
}

function trimToPace(draft: ItineraryDraft, restaurants: Set<string>, cap: number): ItineraryDraft {
  const dropped = new Set(
    [...sightsByDay(draft, restaurants).values()].flatMap((sights) =>
      [...sights].sort((a, b) => minutes(a.startTime) - minutes(b.startTime)).slice(cap),
    ),
  );
  if (!dropped.size) return draft;
  console.warn(`[itinerary] Dropped ${dropped.size} sights over the ${cap}-a-day pace cap`);
  return { ...draft, activities: draft.activities.filter((item) => !dropped.has(item)) };
}

const PACE_ACTIVITIES: Record<TripPace, string> = {
  relaxed: "1-2 activities a day",
  balanced: "2-3 activities a day",
  packed:
    "4-6 sights a day from morning to evening, plus lunch and dinner when restaurantsByCity is given",
};

export function planningPace(brief: TripBrief, preferences: UserPreference[]): TripPace {
  const { pace } = rememberedPlanningPreferences(preferences, brief.intent);
  return TRIP_PACES.find((option) => pace.includes(option)) ?? "balanced";
}

function fallbackDraft(
  brief: TripBrief,
  days: number,
  places: Place[],
  preferences: UserPreference[],
  placesByCity?: ReadonlyMap<string, readonly Place[]>,
  dayCities?: string[][],
  transferWindows: ReadonlyMap<number, TransferWindow[]> = new Map(),
  language?: InterfaceLanguage,
  landing?: Landing,
): ItineraryDraft {
  const candidates = places;
  const { interests, accessibility } = rememberedPlanningPreferences(preferences, brief.intent);
  const pace = planningPace(brief, preferences);

  const cityNames = cities(brief.destination);
  const citiesByDay = dayCities ?? cityForDay(cityNames, days).map((city) => [city]);
  const placesForCity = (city: string): readonly Place[] => {
    const inCity = placesByCity?.get(city) ?? [];
    return placesByCity && placesByCity.size > 1 ? inCity : inCity.length ? inCity : candidates;
  };

  const scarcest = Math.min(
    ...Array.from(
      { length: days },
      (_, day) => placesForCity(citiesByDay[day]?.at(-1) ?? cityNames[0]!).length,
    ),
  );
  const daySlots = pace === "packed" && !accessibility ? PACKED_SLOTS : DAY_SLOTS;
  const perDay =
    accessibility || pace === "relaxed"
      ? 1
      : Math.min(daySlots.length, Math.max(1, Math.floor(scarcest / 2) || 1));

  const slots = perDay === 1 ? [SINGLE_SLOT, ...DAY_SLOTS] : daySlots;
  const activities: ItineraryDraft["activities"] = [];
  const incompleteDays: number[] = [];
  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const day = dayIndex + 1;
    const dayWindows = transferWindows.get(day) ?? [];
    const dayCitiesForActivities = citiesByDay[dayIndex] ?? [cityNames[0]!];
    if (landing && (day < landing.day || (day === landing.day && !landing.earliestStart))) continue;
    const openSlots = landing?.day === day ? arrivalSlots(slots, landing) : slots;
    let added = 0;
    for (const slot of openSlots) {
      const city = dayCitiesForActivities.find((candidate) => {
        const cityPlaces = placesForCity(candidate);
        if (!cityPlaces.length) return false;
        return activityFitsTransferWindows(slot, candidate, dayWindows);
      });
      if (!city) continue;
      const cityPlaces = rankPlacesByInterests(placesForCity(city), interests);
      const place = cityPlaces[(dayIndex * perDay + added) % cityPlaces.length]!;
      activities.push({
        day,
        ...slot,
        location: place.name,
        detail: summaryCopy(language).suggestedStop(place.name, place.category),
      });
      added += 1;
      if (added === perDay) break;
    }
    if (!added) incompleteDays.push(day);
  }
  return {
    summary: summaryCopy(language).itinerary(days, brief.destination, perDay),
    activities,
    assumptions: [
      "Opening hours and live availability must be confirmed before plans are finalised.",
      perDay === 1
        ? "One grounded activity is scheduled each day; the rest of each day is left open."
        : perDay > 2
          ? `Up to ${perDay} grounded stops a day for a packed pace, with lunch and dinner between them.`
          : "Two anchored stops a day, with the middle of the day left for a meal and the journey between them.",
      ...(pace === "relaxed"
        ? ["The remembered relaxed pace is reflected in the one-activity daily schedule."]
        : []),
      ...(interests.length
        ? [
            `Grounded candidates matching remembered interests (${interests.join(", ")}) are preferred when available.`,
          ]
        : []),
      ...(accessibility
        ? [
            `The schedule is limited to one grounded activity per day for the remembered ${accessibility} need; place access and routes are not verified.`,
          ]
        : []),
      ...incompleteDays.map(
        (day) =>
          `Day ${day} is incomplete because no grounded activity fits the existing slots and scheduled transfer window; no late activity time was invented.`,
      ),
    ],
  };
}

function validatedFallbackDraft(
  brief: TripBrief,
  days: number,
  places: Place[],
  preferences: UserPreference[],
  placesByCity: ReadonlyMap<string, readonly Place[]>,
  dayCities: string[][],
  transferWindows: ReadonlyMap<number, TransferWindow[]>,
  language: InterfaceLanguage | undefined,
  landing: Landing | undefined,
  mealsByCity: ReadonlyMap<string, readonly Place[]>,
): ItineraryDraft {
  const grounded = withGrounded(places, placesByCity, mealsByCity);
  return validateDraft(
    withMeals(
      fallbackDraft(
        brief,
        days,
        places,
        preferences,
        placesByCity,
        dayCities,
        transferWindows,
        language,
        landing,
      ),
      days,
      mealsByCity,
      dayCities,
      transferWindows,
      landing,
      language,
      planningPace(brief, preferences) === "packed",
    ),
    days,
    grounded.places,
    dayCities,
    grounded.byCity,
    transferWindows,
    false,
    landing,
  );
}

function createDeepSeekGenerator(): ItineraryGenerator | undefined {
  const model = createRoutedChatModel("itinerary");
  if (!model) return undefined;
  return {
    async generate(input) {
      const evidence = tool(async () => input, {
        name: "read_itinerary_evidence",
        description:
          "Read the validated trip brief, trip length, grounded map candidates, confirmed preferences and any revision request.",
        schema: z.object({}),
      });
      const specialist = createAgent({
        name: "itinerary_specialist",
        model,
        tools: [evidence],
        systemPrompt: `You are the itinerary specialist. Always call read_itinerary_evidence before drafting. Use only its facts and candidate place names. Cover every trip day the traveller is not flying with non-overlapping activities using 24-hour HH:mm times, as many as pace asks: relaxed 1-2, balanced 2-3, packed 4-6 sights a day; pace comes from the traveller and wins over any other count, allow time for the route plus a 15-minute arrival buffer between different locations; route durations are checked after drafting and are not yet verified, and treat activityBudget, what flights and the stay left for activities, as a guide to how many paid attractions to include. Do not state activity prices: no evidence has them. When dayCities is given, every activity on a day must be a candidate from one of that day's cities in candidatesByCity; a transfer day may include departure and arrival cities, but departure-city activities must end before the transfer and arrival-city activities must start after it ends. When otherSections names where the traveller sleeps, build each day around that stay and keep long trips away from it rare. Apply confirmed preferences supplied in the evidence where candidate data allows, especially remembered pace, interests and accessibility needs. On a revision, start from previous and change only what the revision asks. Never claim live hours, availability, safety, visa or weather facts. Address a supplied revision exactly. When schedule is given, it lists every trip day: a day marked travelling gets no activities at all, and a day with earliestStart gets none that start before it. When arrival is given, the traveller is still flying until then: plan nothing before arrival.day, start nothing on that day before arrival.earliestStart, and plan nothing that day when earliestStart is missing; every later day still needs activities. When restaurantsByCity is given, add one lunch or dinner a day (both lunch and dinner for a packed pace) at a restaurant listed for that day's city, each restaurant at most once while others remain, between the day's other stops; never name a restaurant that is not listed. Return the requested structured itinerary draft.\n\nEach activity location must be a candidate's name copied character for character. Do not append its category, rating or district, and do not reword it: an activity whose location is not an exact candidate name is discarded and the whole draft is thrown away.\n\n${TRAVELLER_PREFERENCES_RULE}${replyLanguageRule(input.language)}`,
        responseFormat: ItineraryDraft,
      });
      const result = await specialist.invoke({
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              task: "Draft the itinerary from the validated evidence available through your tool.",
              tripId: input.brief.tripId,
              revision: input.revision?.reason,
              ...(input.feedback
                ? {
                    previousDraftRejected: `${input.feedback} Fix this and return a new draft.`,
                    ...(input.rejectedDraft
                      ? {
                          rejectedDraft: input.rejectedDraft,
                          rejectedDraftRule:
                            "rejectedDraft is the draft that was rejected: keep every activity that is not named in previousDraftRejected, and change only what it names.",
                        }
                      : {}),
                  }
                : {}),
            }),
          },
        ],
      });
      return readStructuredResponse("itinerary", ItineraryDraft, result);
    },
  };
}

async function planItinerary(
  briefInput: TripBrief,
  ctx: AgentContext,
  options: ItineraryAgentOptions,
  revision?: RevisionRequest,
  extras: { allocation?: BudgetAllocation; board?: PlanningBoard; previous?: AgentProposal } = {},
): Promise<AgentProposal> {
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const days = planningDays(brief.dates);

  const activityBudget =
    extras.allocation?.budget ?? brief.budgetTotal * MODEL_ACTIVITY_BUDGET_SHARE;
  const otherSections = (extras.board?.proposals ?? [])
    .filter((proposal) => proposal.agent === "accommodation" || proposal.agent === "transport")
    .map((proposal) => ({
      agent: proposal.agent,
      summary: proposal.summary,
      items: proposal.items.map((item) => `day ${item.day ?? "?"}: ${item.detail}`),
    }));
  const evidenceIssues: string[] = [];
  const readPlaces = async (category: string, near: string, textQuery?: string) => {
    try {
      const found = await ctx.tools.maps.places({
        near,
        category,
        ...(textQuery ? { textQuery } : {}),
      });
      return found.filter(
        (place) =>
          typeof place.name === "string" &&
          place.name.trim().length > 0 &&
          !isGenericPlace(place, near, brief.destination),
      );
    } catch (error) {
      ctx.signal?.throwIfAborted();
      console.warn(
        `[itinerary] Place provider unavailable for ${category} in ${near}: ${error instanceof Error ? error.message : String(error)}`,
      );
      evidenceIssues.push(
        `Place provider unavailable for ${category} in ${near}; using only remaining evidence.`,
      );
      return [];
    }
  };

  const cityNames = cities(brief.destination);
  const preferencesRead = ctx.mem.getLongTerm(brief.userId);
  const readMeals = async (city: string) => {
    const dietary = dietaryPreferencesForBrief(brief, await preferencesRead);
    return [
      city,
      await readPlaces(
        "restaurant",
        city,
        dietary.length
          ? `restaurant in ${city}; dietary requirements: ${dietary.map(({ value }) => value).join("; ")}`
          : undefined,
      ),
    ] as const;
  };
  const wantsMuseums = brief.intent?.interests?.some((interest) =>
    ["museums", "art", "history"].includes(interest),
  );
  const [byCity, preferences, mealsFound] = await Promise.all([
    Promise.all(
      cityNames.map(async (city) => {
        const [sights, neighborhoods, museums] = await Promise.all([
          readPlaces("sight", city),
          readPlaces("neighborhood", city),
          wantsMuseums ? readPlaces("museum", city) : Promise.resolve([]),
        ]);
        return [city, { spots: [...museums, ...sights], neighborhoods }] as const;
      }),
    ),
    preferencesRead,
    Promise.all(cityNames.map(readMeals)),
  ]);
  ctx.signal?.throwIfAborted();
  const pace = planningPace(brief, preferences);
  const placesByCity = new Map(
    byCity.map(([city, { spots, neighborhoods }]) => [
      city,
      [
        ...new Map(
          [...spots, ...(spots.length < days * PACE_MAX[pace] ? neighborhoods : [])].map(
            (place) => [place.name.trim().toLowerCase(), place],
          ),
        ).values(),
      ],
    ]),
  );
  const transportProposal = extras.board?.proposals.find(
    (proposal) => proposal.agent === "transport",
  );
  const transportDayCities = citiesByDay(brief.destination, days, transportProposal);
  const transferWindows = transferWindowsByDay(brief.destination, transportProposal);
  const landing = landingFor(brief, extras.board?.proposals ?? []);
  const staySelections =
    extras.board?.proposals.find((proposal) => proposal.agent === "accommodation")?.stays ?? [];
  const dayCities = citiesForStayNights(
    brief,
    days,
    staySelections,
    transportDayCities,
    transferWindows,
  );
  const places = [
    ...new Map(
      [...placesByCity.values()].flat().map((place) => [place.name.trim().toLowerCase(), place]),
    ).values(),
  ];
  const mealsByCity = mealsByCityFrom(mealsFound, places);
  const grounded = withGrounded(places, placesByCity, mealsByCity);
  if (!places.length) {
    return {
      agent: "itinerary",
      summary: summaryCopy(ctx.replyLanguage).itineraryNeedsPlaces,
      items: [],
      assumptions: [
        ...evidenceIssues,
        "No grounded places available; no attraction, opening time or admission price has been invented.",
      ],
      conflictsWith: [
        "geography conflict: no grounded places available; itinerary requires new evidence",
      ],
      source: {
        kind: "unavailable",
        label: "Maps provider",
        freshness: "No grounded place data was available, so no activities were invented.",
      },
    };
  }
  const generator =
    options.generator === false ? undefined : (options.generator ?? createDeepSeekGenerator());
  let draft: ItineraryDraft;
  let usedFallback = !generator;
  if (generator) {
    let feedback: string | undefined;
    let rejectedDraft: string[] | undefined;
    let accepted: ItineraryDraft | undefined;
    let acceptedConflicts = Infinity;
    const restaurants = new Set(
      [...mealsByCity.values()].flat().map((place) => place.name.trim().toLowerCase()),
    );
    for (let attempt = 0; attempt < 2 && acceptedConflicts > 0; attempt += 1) {
      let generated: ItineraryDraft | undefined;
      try {
        generated = await generator.generate({
          brief,
          days,
          places,
          preferences,
          revision,
          activityBudget,
          pace: { name: pace, activities: PACE_ACTIVITIES[pace] },
          ...(ctx.replyLanguage ? { language: ctx.replyLanguage } : {}),
          ...(placesByCity.size > 1
            ? {
                dayCities: dayCities.map((cities, index) => ({
                  day: index + 1,
                  cities,
                  ...(transferWindows.has(index + 1)
                    ? { transfers: transferWindows.get(index + 1) }
                    : {}),
                })),
                candidatesByCity: Object.fromEntries(
                  [...placesByCity].map(([city, found]) => [
                    city,
                    found.map((place) => place.name),
                  ]),
                ),
              }
            : {}),
          ...(otherSections.length ? { otherSections } : {}),
          ...(extras.previous
            ? {
                previous: {
                  summary: extras.previous.summary,
                  activities: extras.previous.items.map(
                    (item) => `day ${item.day} ${item.startTime}-${item.endTime} ${item.location}`,
                  ),
                },
              }
            : {}),
          ...(feedback ? { feedback } : {}),
          ...(rejectedDraft ? { rejectedDraft } : {}),
          ...(landing ? { arrival: landing } : {}),
          ...(grounded.places.length > places.length
            ? {
                restaurantsByCity: Object.fromEntries(
                  [...mealsByCity].map(([city, found]) => [city, found.map((place) => place.name)]),
                ),
              }
            : {}),
        });
        const valid = validateDraft(
          generated,
          days,
          grounded.places,
          dayCities,
          grounded.byCity,
          transferWindows,
          true,
          landing,
        );
        const tight = [
          ...(
            await travelConflicts(valid, ctx, brief, new Map(), placeCoordinates(grounded.places))
          ).conflicts,
          ...[...sightsByDay(valid, restaurants)]
            .filter(([, sights]) => sights.length > PACE_MAX[pace])
            .map(
              ([day, sights]) =>
                `day ${day} has ${sights.length} sights but a ${pace} pace allows at most ${PACE_MAX[pace]}`,
            ),
        ];
        if (tight.length < acceptedConflicts) {
          accepted = valid;
          acceptedConflicts = tight.length;
        }
        if (tight.length) {
          feedback = `The draft does not fit: ${tight.join("; ")}. Move or drop the stops these name, or pick a nearer candidate.`;
          rejectedDraft = valid.activities.map(
            (item) => `day ${item.day} ${item.startTime}-${item.endTime} ${item.location}`,
          );
        }
      } catch (error) {
        ctx.signal?.throwIfAborted();
        feedback = error instanceof Error ? error.message : "unknown model error";
        rejectedDraft = generated?.activities.map(
          (item) => `day ${item.day} ${item.startTime}-${item.endTime} ${item.location}`,
        );
        console.warn(
          `[itinerary] Model draft failed validation (attempt ${attempt + 1}): ${feedback}`,
        );
      }
    }
    if (accepted) draft = trimToPace(accepted, restaurants, PACE_MAX[pace]);
    else {
      usedFallback = true;
      draft = validatedFallbackDraft(
        brief,
        days,
        places,
        preferences,
        placesByCity,
        dayCities,
        transferWindows,
        ctx.replyLanguage,
        landing,
        mealsByCity,
      );
    }
  } else {
    draft = validatedFallbackDraft(
      brief,
      days,
      places,
      preferences,
      placesByCity,
      dayCities,
      transferWindows,
      ctx.replyLanguage,
      landing,
      mealsByCity,
    );
  }
  let adjusted = avoidBlockedWindows(draft, revision);
  if (usedFallback) {
    try {
      adjusted = {
        ...adjusted,
        draft: validateDraft(
          adjusted.draft,
          days,
          grounded.places,
          dayCities,
          grounded.byCity,
          transferWindows,
          false,
          landing,
        ),
      };
    } catch {
      adjusted = {
        draft,
        conflicts: [
          ...adjusted.conflicts,
          "Fallback activity times were kept unchanged because the requested revision shift conflicts with a scheduled transfer.",
        ],
      };
    }
  }
  draft = adjusted.draft;
  const coordinates = placeCoordinates(grounded.places);
  const placeIds = new Map(
    grounded.places.flatMap((place) =>
      place.placeId ? [[place.name.trim().toLocaleLowerCase(), place.placeId] as const] : [],
    ),
  );
  let connections: Connections = new Map();
  const travel = await travelConflicts(draft, ctx, brief, connections, coordinates);
  let drivingEstimates = travel.drivingEstimates;
  let conflicts = [
    ...adjusted.conflicts,
    ...dayCities.flatMap((allowed, index) =>
      allowed.length
        ? []
        : [
            `geography conflict: day ${index + 1} transport does not end in the selected overnight city; activities were omitted`,
          ],
    ),
    ...travel.conflicts,
    ...(usedFallback
      ? Array.from({ length: days }, (_, index) => index + 1)
          .filter((day) => !landing || day > landing.day)
          .filter((day) => !draft.activities.some((activity) => activity.day === day))
          .map((day) => `incomplete itinerary: no feasible fallback activity for day ${day}`)
      : []),
  ];
  if (revision && conflicts.length && !usedFallback) {
    const originalFallback = validatedFallbackDraft(
      brief,
      days,
      places,
      preferences,
      placesByCity,
      dayCities,
      transferWindows,
      ctx.replyLanguage,
      landing,
      mealsByCity,
    );
    const adjustedFallback = avoidBlockedWindows(originalFallback, revision);
    let fallback = adjustedFallback;
    try {
      fallback = {
        ...adjustedFallback,
        draft: validateDraft(
          adjustedFallback.draft,
          days,
          grounded.places,
          dayCities,
          grounded.byCity,
          transferWindows,
          false,
          landing,
        ),
      };
    } catch {
      fallback = {
        ...adjustedFallback,
        draft: originalFallback,
        conflicts: [
          ...adjustedFallback.conflicts,
          "Fallback activity times were kept unchanged because the requested revision shift conflicts with a scheduled transfer.",
        ],
      };
    }

    const fallbackConnections: Connections = new Map();
    const fallbackTravel = await travelConflicts(
      fallback.draft,
      ctx,
      brief,
      fallbackConnections,
      coordinates,
    );
    const fallbackConflicts = [...fallback.conflicts, ...fallbackTravel.conflicts];
    if (fallbackConflicts.length < conflicts.length) {
      usedFallback = true;
      draft = fallback.draft;
      connections = fallbackConnections;
      drivingEstimates = fallbackTravel.drivingEstimates;
      conflicts = fallbackConflicts;
    }
  }
  return {
    agent: "itinerary",
    summary: usedFallback
      ? draft.summary
      : summaryCopy(ctx.replyLanguage).itinerary(
          days,
          brief.destination,
          Math.max(
            0,
            ...Array.from(
              { length: days },
              (_, index) =>
                draft.activities.filter((activity) => activity.day === index + 1).length,
            ),
          ),
        ),

    items: draft.activities.map(({ estCost: _unpriced, ...activity }) => {
      const arriveBy = connections.get(connectionKey(activity));
      const placeId = placeIds.get(activity.location.trim().toLocaleLowerCase());
      return {
        kind: "activity",
        ...activity,
        ...(placeId ? { placeId } : {}),
        ...(arriveBy ? { arriveBy } : {}),
      };
    }),
    assumptions: [
      ...draft.assumptions,
      ...evidenceIssues,
      ...(landing ? [landingNote(landing)] : []),
      "Different-place connections require route time plus a 15-minute arrival buffer. Opening hours remain unverified.",
      ...(drivingEstimates
        ? [
            "Travel times between stops are OSRM driving estimates; public transport was not checked and can take longer.",
          ]
        : []),
      `Activity prices unknown: no source publishes admission prices for these ${draft.activities.length} stops, so none is counted in the trip total.`,
      ...(placesByCity.size > 1
        ? [
            `Cities by day: ${dayCities.map((cities, index) => `day ${index + 1} ${cities.join(" → ")}`).join("; ")}.`,
          ]
        : []),
      ...(usedFallback
        ? ["Planner source: deterministic fallback from the gathered place evidence."]
        : []),
      ...(revision
        ? [
            `Revision requested: ${revision.reason}.`,
            "The orchestrator must recheck the full plan budget; no percentage saving is claimed without a previous proposal baseline.",
          ]
        : []),
    ],
    conflictsWith: conflicts,
    source: usedFallback
      ? {
          kind: "fallback",
          label: "Local fallback",
          freshness:
            "The model draft was unavailable or invalid; a deterministic itinerary was used from the gathered place evidence.",
        }
      : {
          kind: !mockEnabled() ? "estimated" : "mock",
          label: "Maps evidence and AI plan",
          freshness: !mockEnabled()
            ? "Place and route details are provider estimates; opening hours and availability remain unverified."
            : "Place and route details come from deterministic mock fixtures; not live verified.",
        },
  };
}

export function createItineraryAgent(options: ItineraryAgentOptions = {}): Specialist {
  return {
    name: "itinerary",
    label: "Day plan",
    supportsRevision: true,
    async invoke(request) {
      if (request.revision) {
        if (
          request.revision.tripId !== request.brief.tripId ||
          request.revision.targetAgent !== "itinerary"
        ) {
          throw new Error("Itinerary revision must target this trip and agent.");
        }
      }
      return planItinerary(request.brief, request.context, options, request.revision, {
        ...(request.allocation ? { allocation: request.allocation } : {}),
        ...(request.board ? { board: request.board } : {}),
        ...(request.previous ? { previous: request.previous } : {}),
      });
    },
  };
}

export const itineraryAgent = createItineraryAgent();
