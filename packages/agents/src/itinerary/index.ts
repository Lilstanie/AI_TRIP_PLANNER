import {
  TripBrief as TripBriefSchema,
  type AgentContext,
  type AgentProposal,
  type ArriveBy,
  type GeoPoint,
  type Place,
  type RouteLeg,
  type RouteOption,
  type RouteQuery,
  type TravelMode,
  type RevisionRequest,
  type Specialist,
  type TripBrief,
  type UserPreference,
  type BudgetAllocation,
  type PlanningBoard,
  type StaySelection,
  type InterfaceLanguage,
} from "@trip/shared";
import { z } from "zod/v4";
import { createAgent, tool } from "langchain";
import { createRoutedChatModel, readStructuredResponse } from "../models";
import { dateForDay, planningDays, routeProblem } from "../transport/validation";
import { cities, cityForDay, parseCityHop, scheduledHops } from "../transport/legs";
import { avoidBlockedWindows } from "./revision";
import { mockEnabled } from "@trip/tools";
import { TRAVELLER_PREFERENCES_RULE } from "../prompts/traveller-preferences";
import { replyLanguageRule } from "../prompts/reply-language";
import { summaryCopy } from "../summary-copy";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
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

    activityBudget: number;

    otherSections?: { agent: string; summary: string; items: string[] }[];

    dayCities?: {
      day: number;
      cities: string[];
      transfers?: TransferSegment[];
    }[];
    candidatesByCity?: Record<string, string[]>;

    previous?: { summary: string; activities: string[] };
    language?: InterfaceLanguage;
  }): Promise<ItineraryDraft>;
}

export interface TransferSegment {
  from: string;
  to: string;
  startTime?: string;
  endTime?: string;
}

export interface ItineraryAgentOptions {
  generator?: ItineraryGenerator | false;
}

interface TransferWindow extends TransferSegment {
  day: number;
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

function transferWindowsByDay(
  destination: string,
  transport?: AgentProposal,
): Map<number, TransferWindow[]> {
  const windows = new Map<number, TransferWindow[]>();
  for (const item of transport?.items ?? []) {
    if (!item.day) continue;
    const hop = parseCityHop(destination, item.location);
    if (!hop) continue;
    const { from, to } = hop;
    const startTime =
      item.startTime && item.endTime && TIME.test(item.startTime) && TIME.test(item.endTime)
        ? item.startTime
        : undefined;
    const endTime = startTime ? item.endTime : undefined;
    const dayWindows = windows.get(item.day) ?? [];
    const sameHop = dayWindows.find((window) => window.from === from && window.to === to);
    if (sameHop) {
      if (startTime && endTime && sameHop.startTime && sameHop.endTime) {
        if (minutes(startTime) < minutes(sameHop.startTime)) sameHop.startTime = startTime;
        if (minutes(endTime) > minutes(sameHop.endTime)) sameHop.endTime = endTime;
      } else {
        delete sameHop.startTime;
        delete sameHop.endTime;
      }
    } else {
      dayWindows.push({
        day: item.day,
        from,
        to,
        ...(startTime && endTime ? { startTime, endTime } : {}),
      });
    }
    windows.set(item.day, dayWindows);
  }
  for (const dayWindows of windows.values()) {
    if (dayWindows.every(({ startTime, endTime }) => startTime && endTime))
      dayWindows.sort((left, right) => minutes(left.startTime!) - minutes(right.startTime!));
  }
  return windows;
}

function minutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
}

function activityFitsTransferWindows(
  activity: Pick<ItineraryDraft["activities"][number], "startTime" | "endTime">,
  city: string,
  windows: readonly TransferWindow[],
): boolean {
  if (!windows.length) return true;
  const timedWindows = windows.filter(
    (window): window is TransferWindow & { startTime: string; endTime: string } =>
      Boolean(window.startTime && window.endTime),
  );
  if (timedWindows.length !== windows.length) return false;
  const start = minutes(activity.startTime);
  const end = minutes(activity.endTime);
  if (
    timedWindows.some(
      (window) => start < minutes(window.endTime) && end > minutes(window.startTime),
    )
  )
    return false;
  const previous = timedWindows.filter((window) => minutes(window.endTime) <= start).at(-1);
  const next = timedWindows.find((window) => minutes(window.startTime) >= end);
  if (previous && next) return previous.to === city && next.from === city;
  if (previous) return previous.to === city;
  if (next) return next.from === city;
  return false;
}

function validateDraft(
  draft: ItineraryDraft,
  days: number,
  places: Place[],
  dayCities?: string[][],
  placesByCity?: ReadonlyMap<string, readonly Place[]>,
  transferWindows: ReadonlyMap<number, TransferWindow[]> = new Map(),
  requireEveryDay = true,
): ItineraryDraft {
  const parsed = ItineraryDraft.parse(draft);

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
  if (requireEveryDay && representedDays.size !== days)
    throw new Error("Itinerary must include every trip day.");
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

function fallbackDraft(
  brief: TripBrief,
  days: number,
  places: Place[],
  placesByCity?: ReadonlyMap<string, readonly Place[]>,
  dayCities?: string[][],
  transferWindows: ReadonlyMap<number, TransferWindow[]> = new Map(),
  language?: InterfaceLanguage,
): ItineraryDraft {
  const candidates = places;

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
  const perDay = Math.min(DAY_SLOTS.length, Math.max(1, Math.floor(scarcest / 2) || 1));

  const slots = perDay === 1 ? [SINGLE_SLOT, ...DAY_SLOTS] : DAY_SLOTS;
  const activities: ItineraryDraft["activities"] = [];
  const incompleteDays: number[] = [];
  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const day = dayIndex + 1;
    const dayWindows = transferWindows.get(day) ?? [];
    const dayCitiesForActivities = citiesByDay[dayIndex] ?? [cityNames[0]!];
    let added = 0;
    for (const slot of slots) {
      const city = dayCitiesForActivities.find((candidate) => {
        const cityPlaces = placesForCity(candidate);
        if (!cityPlaces.length) return false;
        return activityFitsTransferWindows(slot, candidate, dayWindows);
      });
      if (!city) continue;
      const cityPlaces = placesForCity(city);
      const place = cityPlaces[(dayIndex * perDay + added) % cityPlaces.length]!;
      activities.push({
        day,
        ...slot,
        location: place.name,
        detail: `${place.name} (${place.category}) is a suggested stop; confirm timing and suitability before visiting.`,
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
        ? "Only enough grounded places for one anchored activity a day; the rest of each day is left open."
        : "Two anchored stops a day, with the middle of the day left for a meal and the journey between them.",
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
  placesByCity: ReadonlyMap<string, readonly Place[]>,
  dayCities: string[][],
  transferWindows: ReadonlyMap<number, TransferWindow[]>,
  language: InterfaceLanguage | undefined,
): ItineraryDraft {
  return validateDraft(
    fallbackDraft(brief, days, places, placesByCity, dayCities, transferWindows, language),
    days,
    places,
    dayCities,
    placesByCity,
    transferWindows,
    false,
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
        systemPrompt: `You are the itinerary specialist. Always call read_itinerary_evidence before drafting. Use only its facts and candidate place names. Cover every trip day with 1-3 non-overlapping activities using 24-hour HH:mm times, leave 150 minutes between different locations, and treat activityBudget, what flights and the stay left for activities, as a guide to how many paid attractions to include. Do not state activity prices: no evidence has them. When dayCities is given, every activity on a day must be a candidate from one of that day's cities in candidatesByCity; a transfer day may include departure and arrival cities, but departure-city activities must end before the transfer and arrival-city activities must start after it ends. When otherSections names where the traveller sleeps, build each day around that stay and keep long trips away from it rare. On a revision, start from previous and change only what the revision asks. Never claim live hours, availability, safety, visa or weather facts. Address a supplied revision exactly. Return the requested structured itinerary draft.\n\nEach activity location must be a candidate's name copied character for character. Do not append its category, rating or district, and do not reword it: an activity whose location is not an exact candidate name is discarded and the whole draft is thrown away.\n\n${TRAVELLER_PREFERENCES_RULE}${replyLanguageRule(input.language)}`,
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
                ? { previousDraftRejected: `${input.feedback} Fix this and return a new draft.` }
                : {}),
            }),
          },
        ],
      });
      return readStructuredResponse("itinerary", ItineraryDraft, result);
    },
  };
}

export type Connections = Map<string, ArriveBy>;

const connectionKey = (activity: { day: number; startTime: string; location: string }) =>
  `${activity.day}|${activity.startTime}|${activity.location}`;

function describeHop(
  legs: RouteLeg[],
  options: RouteOption[],
): { mode: TravelMode; line?: string } {
  const best = options.find((option) => option.mode !== "drive") ?? options[0];

  const line = best?.note?.match(/via [a-z]+ ([\w-]+)/i)?.[1];
  if (best) return { mode: best.mode, ...(line ? { line } : {}) };
  const leg = legs[0];
  return { mode: leg?.mode ?? "transit" };
}

function placeCoordinates(places: Place[]): ReadonlyMap<string, GeoPoint> {
  return new Map(
    places.flatMap((place) =>
      place.location ? [[place.name.trim().toLocaleLowerCase(), place.location] as const] : [],
    ),
  );
}

async function travelConflicts(
  draft: ItineraryDraft,
  ctx: AgentContext,
  brief: TripBrief,
  connections: Connections,
  coordinates: ReadonlyMap<string, GeoPoint>,
): Promise<string[]> {
  const conflicts: string[] = [];
  const days = new Set(draft.activities.map((activity) => activity.day));
  for (const day of days) {
    const activities = draft.activities
      .filter((activity) => activity.day === day)
      .sort((left, right) => minutes(left.startTime) - minutes(right.startTime));
    for (let index = 1; index < activities.length; index += 1) {
      const previous = activities[index - 1]!;
      const current = activities[index]!;
      if (previous.location === current.location) continue;
      ctx.signal?.throwIfAborted();

      const at = (name: string) => coordinates.get(name.trim().toLocaleLowerCase());
      const fromLocation = at(previous.location);
      const toLocation = at(current.location);
      const query: RouteQuery = {
        from: previous.location,
        to: current.location,
        date: dateForDay(brief.dates[0], day),
        localTime: previous.endTime,
        ...(fromLocation ? { fromLocation } : {}),
        ...(toLocation ? { toLocation } : {}),
      };
      let legs;
      try {
        legs = await ctx.tools.maps.route(query);
      } catch {
        ctx.signal?.throwIfAborted();
        conflicts.push(
          `geography conflict on day ${day}: route provider failed; connection unverified`,
        );
        continue;
      }
      ctx.signal?.throwIfAborted();
      const problem = routeProblem(legs);
      if (problem) {
        conflicts.push(
          `geography conflict on day ${day}: ${previous.location} to ${current.location}: ${problem}`,
        );
        continue;
      }
      const durationMin = Math.ceil(legs.reduce((sum, leg) => sum + leg.durationMin, 0));

      const options = ctx.tools.maps.routeOptions
        ? await ctx.tools.maps.routeOptions(query).catch(() => [] as RouteOption[])
        : [];
      if (durationMin > 0) {
        const { mode, line } = describeHop(legs, options);
        connections.set(connectionKey(current), {
          mode,
          durationMin,
          ...(line ? { line } : {}),
          from: previous.location,
        });
      }
      const required = durationMin + 15;
      const available = minutes(current.startTime) - minutes(previous.endTime);
      if (required > available) {
        conflicts.push(
          `geography conflict on day ${day}: ${previous.location} to ${current.location} needs ${required} minutes including a 15-minute buffer but only ${available} are available`,
        );
      }
    }
  }
  return conflicts;
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
  const readPlaces = async (category: string, near: string) => {
    try {
      const found = await ctx.tools.maps.places({ near, category });
      return found.filter(
        (place) =>
          typeof place.name === "string" &&
          place.name.trim().length > 0 &&
          !isGenericPlace(place, near, brief.destination),
      );
    } catch {
      ctx.signal?.throwIfAborted();
      evidenceIssues.push(
        `Place provider unavailable for ${category} in ${near}; using only remaining evidence.`,
      );
      return [];
    }
  };

  const cityNames = cities(brief.destination);
  const [byCity, preferences] = await Promise.all([
    Promise.all(
      cityNames.map(async (city) => {
        const [sights, neighborhoods] = await Promise.all([
          readPlaces("sight", city),
          readPlaces("neighborhood", city),
        ]);
        return [
          city,
          [
            ...new Map(
              [...sights, ...neighborhoods].map((place) => [
                place.name.trim().toLowerCase(),
                place,
              ]),
            ).values(),
          ],
        ] as const;
      }),
    ),
    ctx.mem.getLongTerm(brief.userId),
  ]);
  ctx.signal?.throwIfAborted();
  const placesByCity = new Map(byCity);
  const transportProposal = extras.board?.proposals.find(
    (proposal) => proposal.agent === "transport",
  );
  const transportDayCities = citiesByDay(brief.destination, days, transportProposal);
  const transferWindows = transferWindowsByDay(brief.destination, transportProposal);
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
    let accepted: ItineraryDraft | undefined;
    for (let attempt = 0; attempt < 2 && !accepted; attempt += 1) {
      try {
        accepted = validateDraft(
          await generator.generate({
            brief,
            days,
            places,
            preferences,
            revision,
            activityBudget,
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
                      (item) =>
                        `day ${item.day} ${item.startTime}-${item.endTime} ${item.location}`,
                    ),
                  },
                }
              : {}),
            ...(feedback ? { feedback } : {}),
          }),
          days,
          places,
          dayCities,
          placesByCity,
          transferWindows,
        );
      } catch (error) {
        ctx.signal?.throwIfAborted();
        feedback = error instanceof Error ? error.message : "unknown model error";
        console.warn(
          `[itinerary] Model draft failed validation (attempt ${attempt + 1}): ${feedback}`,
        );
      }
    }
    if (accepted) draft = accepted;
    else {
      usedFallback = true;
      draft = validatedFallbackDraft(
        brief,
        days,
        places,
        placesByCity,
        dayCities,
        transferWindows,
        ctx.replyLanguage,
      );
    }
  } else {
    draft = validatedFallbackDraft(
      brief,
      days,
      places,
      placesByCity,
      dayCities,
      transferWindows,
      ctx.replyLanguage,
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
          places,
          dayCities,
          placesByCity,
          transferWindows,
          false,
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
  const coordinates = placeCoordinates(places);
  let connections: Connections = new Map();
  let conflicts = [
    ...adjusted.conflicts,
    ...dayCities.flatMap((allowed, index) =>
      allowed.length
        ? []
        : [
            `geography conflict: day ${index + 1} transport does not end in the selected overnight city; activities were omitted`,
          ],
    ),
    ...(await travelConflicts(draft, ctx, brief, connections, coordinates)),
    ...(usedFallback
      ? Array.from({ length: days }, (_, index) => index + 1)
          .filter((day) => !draft.activities.some((activity) => activity.day === day))
          .map((day) => `incomplete itinerary: no feasible fallback activity for day ${day}`)
      : []),
  ];
  if (revision && conflicts.length && !usedFallback) {
    const originalFallback = validatedFallbackDraft(
      brief,
      days,
      places,
      placesByCity,
      dayCities,
      transferWindows,
      ctx.replyLanguage,
    );
    const adjustedFallback = avoidBlockedWindows(originalFallback, revision);
    let fallback = adjustedFallback;
    try {
      fallback = {
        ...adjustedFallback,
        draft: validateDraft(
          adjustedFallback.draft,
          days,
          places,
          dayCities,
          placesByCity,
          transferWindows,
          false,
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
    const fallbackConflicts = [
      ...fallback.conflicts,
      ...(await travelConflicts(fallback.draft, ctx, brief, fallbackConnections, coordinates)),
    ];
    if (fallbackConflicts.length < conflicts.length) {
      usedFallback = true;
      draft = fallback.draft;
      connections = fallbackConnections;
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
      return { kind: "activity", ...activity, ...(arriveBy ? { arriveBy } : {}) };
    }),
    assumptions: [
      ...draft.assumptions,
      ...evidenceIssues,
      "Different-place connections require route time plus a 15-minute arrival buffer. Opening hours remain unverified.",
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
