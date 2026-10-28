import type { InterfaceLanguage, WeatherResult } from "@trip/shared";

type WeatherLine = Pick<WeatherResult, "horizon" | "summary">;

interface StayLine {
  rooms: number;
  nights: number;
  cities: string[];
  money: string;
  lowestCost: boolean;
}

interface TransportLine {
  options: number;
  origin: string;
  destinations: string[];
  money: string;
  unpriced: number;
  unavailable: number;
  incomplete: boolean;
}

const ENGLISH = {
  stays: ({ rooms, nights, cities, money, lowestCost }: StayLine) =>
    `${plural(rooms, "room", "rooms")}, ${plural(nights, "night", "nights")} in ${cities.join(" & ")} · ${money}${lowestCost ? " (lowest eligible cost)" : ""}`,
  bookedStay: (name: string, nights: number) =>
    `${name} · booked by you, ${plural(nights, "night", "nights")} · not priced`,
  guide: (destination: string, date: string) =>
    `${destination} planning guidance for ${month(date, "en")}`,
  dining: (summary: string, money: string) => `${summary} · ${money} meal budget`,
  diningCandidates: (count: number) =>
    count
      ? `${plural(count, "grounded dining candidate", "grounded dining candidates")} within a whole-trip meal budget envelope`
      : "No grounded dining candidates; using a whole-trip meal budget envelope",
  itinerary: (days: number, destination: string, perDay: number) =>
    `${days}-day plan for ${destination} with up to ${perDay} grounded ${perDay === 1 ? "activity" : "activities"} per day`,
  itineraryNeedsPlaces: "Itinerary needs verified place data",
  transportIncomplete:
    "Inter-city travel is incomplete: available routes and fares could not be verified.",
  transportNone: "No inter-city travel is needed for this trip.",
  attraction: (category: string, rating?: number) =>
    `${category} candidate${rating ? ` with supplied rating ${rating}` : ""}; verify opening hours and suitability before visiting.`,
  diningPick: (category: string, rating: number | undefined, requirements: string) =>
    `${category} candidate${rating ? ` with supplied rating ${rating}` : ""}.${requirements ? ` Ask the venue to confirm these requirements directly: ${requirements}.` : " Confirm ingredients and dietary suitability directly with the venue."}`,
  suggestedStop: (name: string, category: string) =>
    `${name} (${category}) is a suggested stop; confirm timing and suitability before visiting.`,
  customs: "Follow posted venue rules and check official local visitor guidance before travel.",
  safety:
    "Save local emergency contacts, keep copies of essential documents, and follow current official travel advisories.",
  entryHealth: (nationality?: string) =>
    `Check current official immigration and public-health requirements${nationality ? ` for a ${nationality} passport` : " for each traveller's passport"}; requirements can change.`,
  entryHealthVerify:
    " Verify all entry and health rules against current official government sources before booking or departure.",
  entryHealthShort: "check official sources",
  monthlyWeather: (date: string) =>
    `For ${month(date, "en")}, use this as planning context only and check an official short-range forecast shortly before departure.`,
  monthScope: (start: string, end: string) =>
    `Planning context for ${monthYear(start, "en")} only; recheck guidance for the remaining months through ${monthYear(end, "en")}. `,
  packingRain: "Waterproof jacket and rain protection",
  packingCold: "Warm insulating layers for cooler conditions",
  packingHeat: "Sun protection and lightweight clothing",
  packingLayers: "Weather-appropriate layers",
  packingBasics: [
    "Comfortable walking shoes",
    "Medication and copies of prescriptions",
    "Travel documents and suitable power adapters",
  ],
  weather: (city: string, date: string, result?: WeatherLine) =>
    result
      ? `${city}, ${day(date, "en-AU")} (${result.horizon === "forecast" ? "forecast" : "historical climate, not a forecast"}): ${result.summary}`
      : `${city}, ${day(date, "en-AU")}: weather unavailable; check a current forecast before travel.`,
  weatherUnavailable: (city: string, dates: string[]) =>
    `${city}, ${dates.map((date) => day(date, "en-AU")).join("; ")}: weather unavailable; check a current forecast before travel.`,
  transport: ({
    options,
    origin,
    destinations,
    money,
    unpriced,
    unavailable,
    incomplete,
  }: TransportLine) =>
    `${plural(options, "transport option", "transport options")} for ${origin} ↔ ${destinations.join(" → ")} · known estimate ${money}${unpriced ? ` · ${plural(unpriced, "leg", "legs")} unpriced` : ""}${unavailable ? ` · ${plural(unavailable, "travel choice", "travel choices")} unavailable` : ""}${incomplete ? " (incomplete/unverified)" : ""}`,
};

const CHINESE: typeof ENGLISH = {
  stays: ({ rooms, nights, cities, money, lowestCost }) =>
    `${rooms} 间房，${cities.join("、")}共 ${nights} 晚 · ${money}${lowestCost ? "（最低可选价格）" : ""}`,
  bookedStay: (name, nights) => `${name} · 你已预订，${nights} 晚 · 未计价`,
  guide: (destination, date) => `${destination}${month(date, "zh-CN")}出行指南`,
  dining: (summary, money) => `${summary} · 餐饮预算 ${money}`,
  diningCandidates: (count) =>
    count
      ? `${count} 个已核实的餐饮候选，按全程餐饮预算估算`
      : "没有已核实的餐饮候选，按全程餐饮预算估算",
  itinerary: (days, destination, perDay) =>
    `${destination} ${days} 天行程，每天最多 ${perDay} 个已核实的活动`,
  itineraryNeedsPlaces: "行程需要已核实的地点数据",
  transportIncomplete: "城际交通不完整：无法核实可用路线和票价。",
  transportNone: "本次行程不需要城际交通。",
  attraction: (_category, rating) =>
    `候选景点${rating ? `，评分 ${rating}` : ""}；前往前请确认开放时间和是否适合。`,
  diningPick: (_category, rating, requirements) =>
    `候选餐厅${rating ? `，评分 ${rating}` : ""}。${requirements ? `请直接向餐厅确认这些要求：${requirements}。` : "请直接向餐厅确认食材和饮食要求。"}`,
  suggestedStop: (name) => `${name}：推荐游览点，出发前请确认时间和是否适合。`,
  customs: "遵守场所张贴的规定，出行前查看当地官方游客指引。",
  safety: "保存当地紧急联系方式，备份重要证件，并关注最新的官方旅行提示。",
  entryHealth: (nationality) =>
    `请查看最新的官方入境与公共卫生要求${nationality ? `（${nationality} 护照）` : "（按每位旅行者的护照）"}；要求可能会变。`,
  entryHealthVerify: "预订或出发前，请以政府官方渠道的最新入境与健康规定为准。",
  entryHealthShort: "以官方渠道为准",
  monthlyWeather: (date) => `${month(date, "zh-CN")}的天气仅作规划参考，出发前请查看官方短期预报。`,
  monthScope: (start, end) =>
    `以下仅为${monthYear(start, "zh-CN")}的规划参考；${monthYear(end, "zh-CN")}之前的其余月份请重新查看。`,
  packingRain: "防水外套和雨具",
  packingCold: "保暖衣物，应对较凉的天气",
  packingHeat: "防晒用品和轻薄衣物",
  packingLayers: "适合天气的衣物",
  packingBasics: ["舒适的步行鞋", "药品和处方复印件", "旅行证件和合适的电源转换插头"],
  weather: (city, date, result) =>
    result
      ? `${city}，${day(date, "zh-CN")}（${result.horizon === "forecast" ? "预报" : "历史气候，非预报"}）：${result.summary}`
      : `${city}，${day(date, "zh-CN")}：暂无天气数据，出行前请查看最新预报。`,
  weatherUnavailable: (city, dates) =>
    `${city}，${dates.map((date) => day(date, "zh-CN")).join("、")}：暂无天气数据，出行前请查看最新预报。`,
  transport: ({ options, origin, destinations, money, unpriced, unavailable, incomplete }) =>
    `${options} 个交通方案（${origin} ↔ ${destinations.join(" → ")}）· 已知估算 ${money}${unpriced ? ` · ${unpriced} 段未计价` : ""}${unavailable ? ` · ${unavailable} 个出行选择不可用` : ""}${incomplete ? "（不完整/未核实）" : ""}`,
};

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function month(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
    Date.parse(`${date}T00:00:00.000Z`),
  );
}

function monthYear(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.parse(`${date}T12:00:00.000Z`));
}

function day(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(Date.parse(`${date}T00:00:00.000Z`));
}

export function summaryCopy(language: InterfaceLanguage | undefined): typeof ENGLISH {
  return language === "zh" ? CHINESE : ENGLISH;
}
