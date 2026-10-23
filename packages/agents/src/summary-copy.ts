import type { InterfaceLanguage } from "@trip/shared";

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

export function summaryCopy(language: InterfaceLanguage | undefined): typeof ENGLISH {
  return language === "zh" ? CHINESE : ENGLISH;
}
