import {
  splitDestinationSchedule,
  type StayOption,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";

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
}

export function readPreferences(prefs: UserPreference[]): StayPreferences {
  const values = new Map(prefs.map((pref) => [pref.key, pref.value]));
  const roomAllocation = values.get("accommodation.roomAllocation") ?? "shared";
  const rating = values.get("accommodation.minRating") ?? "0";
  const minRating = Number(rating);
  const cancellation = values.get("accommodation.freeCancellation") ?? "false";
  if (roomAllocation !== "shared" && roomAllocation !== "individual") {
    throw new Error("accommodation.roomAllocation must be shared or individual.");
  }
  if (!rating.trim() || !Number.isFinite(minRating) || minRating < 0 || minRating > 10) {
    throw new Error("accommodation.minRating must be a number between 0 and 10.");
  }
  if (cancellation !== "true" && cancellation !== "false") {
    throw new Error("accommodation.freeCancellation must be true or false.");
  }
  return { roomAllocation, minRating, freeCancellation: cancellation === "true" };
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

export function splitStay(brief: TripBrief): StaySegment[] {
  if (!Number.isSafeInteger(brief.groupSize) || brief.groupSize <= 0) {
    throw new Error("Accommodation requires a positive integer group size.");
  }
  const start = parseDate(brief.dates[0]);
  const nights = (parseDate(brief.dates[1]) - start) / DAY_MS;
  if (nights <= 0) throw new Error("Accommodation check-out must be after check-in.");
  let offset = 0;
  return splitDestinationSchedule(brief.destination, nights).map((schedule) => {
    const segment = {
      city: schedule.city,
      checkIn: new Date(start + offset * DAY_MS).toISOString().slice(0, 10),
      checkOut: new Date(start + (offset + schedule.nights) * DAY_MS).toISOString().slice(0, 10),
      nights: schedule.nights,
      day: schedule.startDay,
    };
    offset += schedule.nights;
    return segment;
  });
}

export function eligibleOptions(options: StayOption[], prefs: StayPreferences): StayOption[] {
  return options
    .filter(
      (option) =>
        typeof option.name === "string" &&
        option.name.trim().length > 0 &&
        typeof option.area === "string" &&
        option.area.trim().length > 0 &&
        Number.isFinite(option.pricePerNightUsd) &&
        option.pricePerNightUsd > 0 &&
        Number.isFinite(option.rating) &&
        option.rating >= prefs.minRating &&
        option.rating <= 10 &&
        typeof option.freeCancellation === "boolean" &&
        (!prefs.freeCancellation || option.freeCancellation),
    )
    .sort(
      (a, b) =>
        a.pricePerNightUsd - b.pricePerNightUsd ||
        b.rating - a.rating ||
        a.name.localeCompare(b.name),
    );
}

export function chooseInitial(options: StayOption[]): StayOption {
  // Rating >=8 and cancellation are soft defaults; confirmed preferences are filtered first.
  return options.find((option) => option.rating >= 8 && option.freeCancellation) ?? options[0]!;
}

export function stayCost(option: StayOption, nights: number, rooms: number): number {
  const nightlyCents = Math.round((option.pricePerNightUsd + Number.EPSILON) * 100);
  const cents = nightlyCents * nights * rooms;
  if (!Number.isSafeInteger(cents) || nightlyCents <= 0)
    throw new Error("Accommodation estimate exceeds supported precision.");
  return cents / 100;
}
