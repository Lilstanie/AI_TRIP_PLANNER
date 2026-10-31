import type { ScheduledHop } from "../transport/legs";
import type { StayOption, TripBrief, TripIntent, UserPreference } from "@trip/shared";

const DAY_MS = 86_400_000;

export interface StaySegment {
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  day: number;
}

export interface StayPreferences {
  roomAllocation: "shared" | "individual";
  minRating: number;
  freeCancellation: boolean;
  stayType?: string;
}

export function readPreferences(prefs: UserPreference[]): StayPreferences {
  const values = new Map(prefs.map((pref) => [pref.key, pref.value]));
  const rememberedValue = values.get("accommodation") ?? "";
  let remembered: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(rememberedValue);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      remembered = parsed as Record<string, unknown>;
  } catch {
    remembered = {};
  }
  const legacy = rememberedValue.toLocaleLowerCase();
  const stayType =
    (typeof remembered.stayType === "string" &&
    /^(hotel|hostel|apartment|guesthouse)$/.test(remembered.stayType)
      ? remembered.stayType
      : undefined) ?? /^(hotel|hostel|apartment|guesthouse)$/.exec(legacy)?.[1];
  const roomAllocation = values.get("accommodation.roomAllocation") ?? "shared";
  const rating =
    values.get("accommodation.minRating") ??
    (typeof remembered.minRating === "number" ? String(remembered.minRating) : undefined) ??
    legacy.match(/(?:minimum|min)\s+rating\s*:?\s*(10(?:\.0)?|\d(?:\.\d)?)/)?.[1] ??
    "0";
  const minRating = Number(rating);
  const cancellation =
    values.get("accommodation.freeCancellation") ??
    (typeof remembered.freeCancellation === "boolean"
      ? String(remembered.freeCancellation)
      : legacy.includes("free cancellation")
        ? "true"
        : "false");
  if (roomAllocation !== "shared" && roomAllocation !== "individual") {
    throw new Error("accommodation.roomAllocation must be shared or individual.");
  }
  if (!rating.trim() || !Number.isFinite(minRating) || minRating < 0 || minRating > 10) {
    throw new Error("accommodation.minRating must be a number between 0 and 10.");
  }
  if (cancellation !== "true" && cancellation !== "false") {
    throw new Error("accommodation.freeCancellation must be true or false.");
  }
  return {
    roomAllocation,
    minRating,
    freeCancellation: cancellation === "true",
    ...(stayType ? { stayType } : {}),
  };
}

export function withStayIntent(prefs: StayPreferences, stay?: TripIntent["stay"]): StayPreferences {
  return stay ? { ...prefs, ...stay } : prefs;
}

function parseDate(date: string): number {
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(value) ||
    new Date(value).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Accommodation requires a valid YYYY-MM-DD date: ${date}`);
  }
  return value;
}

export function splitStay(
  brief: TripBrief,
  hops: ScheduledHop[] = [],
  arrivalDay = 1,
): StaySegment[] {
  if (!Number.isSafeInteger(brief.groupSize) || brief.groupSize <= 0) {
    throw new Error("Accommodation requires a positive integer group size.");
  }
  const start = parseDate(brief.dates[0]);
  const nights = (parseDate(brief.dates[1]) - start) / DAY_MS;
  if (nights <= 0) throw new Error("Accommodation check-out must be after check-in.");

  const cities = brief.destination.split("&").map((city) => city.trim());
  if (cities.some((city) => !city)) throw new Error("Accommodation requires non-empty cities.");
  const fromHops = hopNights(cities, nights, hops);
  if (!fromHops && nights < cities.length)
    throw new Error("Each destination needs at least one overnight stay.");
  let offset = 0;
  return cities.flatMap((city, index) => {
    let cityNights =
      fromHops?.[index] ??
      Math.floor(nights / cities.length) + (index < nights % cities.length ? 1 : 0);
    if (index === 0 && arrivalDay > 1 && arrivalDay - 1 < cityNights) {
      offset = arrivalDay - 1;
      cityNights -= offset;
    }
    if (cityNights === 0) return [];
    const segment = {
      city,
      checkIn: new Date(start + offset * DAY_MS).toISOString().slice(0, 10),
      checkOut: new Date(start + (offset + cityNights) * DAY_MS).toISOString().slice(0, 10),
      nights: cityNights,
      day: offset + 1,
    };
    offset += cityNights;
    return [segment];
  });
}

function hopNights(cities: string[], nights: number, hops: ScheduledHop[]): number[] | undefined {
  if (cities.length < 2 || hops.length !== cities.length - 1) return undefined;
  const arrivals = [1];
  for (const [index, hop] of hops.entries()) {
    if (hop.from !== cities[index] || hop.to !== cities[index + 1]) return undefined;
    arrivals.push(hop.day);
  }
  const counts = arrivals.map((day, index) => (arrivals[index + 1] ?? nights + 1) - day);
  return counts.every((count) => count >= 0) ? counts : undefined;
}

export function eligibleOptions(options: StayOption[], prefs: StayPreferences): StayOption[] {
  return options
    .filter(
      (option) =>
        typeof option.name === "string" &&
        option.name.trim().length > 0 &&
        typeof option.area === "string" &&
        option.area.trim().length > 0 &&
        Number.isFinite(option.pricePerNight) &&
        option.pricePerNight > 0 &&
        Number.isFinite(option.rating) &&
        option.rating >= prefs.minRating &&
        option.rating <= 10 &&
        (option.freeCancellation === undefined || typeof option.freeCancellation === "boolean") &&
        (!prefs.freeCancellation || option.freeCancellation !== false),
    )
    .sort(
      (a, b) =>
        a.pricePerNight - b.pricePerNight || b.rating - a.rating || a.name.localeCompare(b.name),
    );
}

export function chooseInitial(options: StayOption[]): StayOption {
  const met = (option: StayOption) =>
    Number(option.rating >= 8) + Number(option.freeCancellation === true);
  return options.reduce((best, option) => (met(option) > met(best) ? option : best), options[0]!);
}

export function chooseRevised(
  options: StayOption[],
  fits: (option: StayOption) => boolean,
  allocated: boolean,
): StayOption {
  if (!allocated) return options[0]!;
  const fitting = options.filter(fits);
  return fitting.length ? chooseInitial(fitting) : options[0]!;
}

export function stayCost(option: StayOption, nights: number, rooms: number): number {
  const nightlyCents = Math.round((option.pricePerNight + Number.EPSILON) * 100);
  const cents = nightlyCents * nights * rooms;
  if (!Number.isSafeInteger(cents) || nightlyCents <= 0)
    throw new Error("Accommodation estimate exceeds supported precision.");
  return cents / 100;
}
