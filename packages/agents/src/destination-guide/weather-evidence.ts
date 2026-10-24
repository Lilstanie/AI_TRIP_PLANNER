import type {
  AgentContext,
  InterfaceLanguage,
  Place,
  TripBrief,
  WeatherResult,
} from "@trip/shared";
import { summaryCopy } from "../summary-copy";

export interface DestinationWeatherEvidence {
  city: string;
  targetDate: string;
  result?: WeatherResult;
  unavailable?: true;
}

export async function gatherWeatherEvidence(
  brief: TripBrief,
  ctx: AgentContext,
  cities: Array<{ city: string; places: Place[] }>,
): Promise<DestinationWeatherEvidence[]> {
  if (!ctx.tools.weather) return [];
  const start = Date.parse(`${brief.dates[0]}T00:00:00Z`);
  const end = Date.parse(`${brief.dates[1]}T00:00:00Z`);
  const jobs = cities.flatMap(({ city, places }) => {
    const location = places.find((place) => place.location)?.location;
    return Array.from({ length: (end - start) / 86_400_000 + 1 }, (_, day) => ({
      city,
      location,
      targetDate: new Date(start + day * 86_400_000).toISOString().slice(0, 10),
    }));
  });
  const evidence = new Array<DestinationWeatherEvidence>(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, jobs.length) }, async () => {
      while (next < jobs.length) {
        ctx.signal?.throwIfAborted();
        const index = next++;
        const { city, location, targetDate } = jobs[index]!;
        try {
          if (!location) throw new Error("No grounded coordinates for weather.");
          const result = await ctx.tools.weather!.forecast({ location, targetDate });
          ctx.signal?.throwIfAborted();
          if (result.targetDate !== targetDate)
            throw new Error("Weather date did not match the request.");
          evidence[index] = { city, targetDate, result };
        } catch {
          ctx.signal?.throwIfAborted();
          evidence[index] = { city, targetDate, unavailable: true };
        }
      }
    }),
  );
  return evidence;
}

export function weatherPacking(
  evidence: DestinationWeatherEvidence[],
  language: InterfaceLanguage | undefined,
): string[] {
  const summaries = evidence.flatMap(({ result }) => (result ? [result.summary] : [])).join(" ");
  if (!summaries) return [];
  const copy = summaryCopy(language);
  const packing: string[] = [];
  if (/rain|drizzle|thunderstorm|snow|precipitation|雨|雪/i.test(summaries))
    packing.push(copy.packingRain);
  const temperatures = [
    ...summaries.matchAll(/(-?\d+(?:\.\d+)?)\s*[–−-]\s*(-?\d+(?:\.\d+)?)\s*°C/g),
  ].flatMap((match) => [Number(match[1]), Number(match[2])]);
  if (
    /cool|cold|snow|寒|冷/i.test(summaries) ||
    temperatures.some((temperature) => temperature < 10)
  )
    packing.push(copy.packingCold);
  if (/warm|hot|晴|炎热/i.test(summaries) || temperatures.some((temperature) => temperature >= 25))
    packing.push(copy.packingHeat);
  return packing.length ? packing : [copy.packingLayers];
}

export function weatherText(
  evidence: DestinationWeatherEvidence[],
  language: InterfaceLanguage | undefined,
): string {
  const copy = summaryCopy(language);
  const missing = new Map<string, string[]>();
  for (const { city, targetDate, result } of evidence)
    if (!result) missing.set(city, [...(missing.get(city) ?? []), targetDate]);
  return evidence
    .flatMap(({ city, targetDate, result }) => {
      if (result) return [copy.weather(city, targetDate, result)];
      const dates = missing.get(city) ?? [];
      return dates[0] === targetDate ? [copy.weatherUnavailable(city, dates)] : [];
    })
    .join(" ");
}
