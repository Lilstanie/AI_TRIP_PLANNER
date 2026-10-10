import {
  formatMoney,
  type Currency,
  BOUNDED_RESULT_ROWS,
  type AgentName,
  type AgentProgressEvent,
  type BookingPort,
  type FlightOption,
  type FlightQuery,
  type MapsPort,
  type Place,
  type RouteLeg,
  type RouteOption,
  type RouteQuery,
  type StayOption,
  type StayQuery,
  type ToolGateway,
  type ToolResultKind,
  type ToolResultRow,
  type WeatherPort,
  type WeatherQuery,
} from "@trip/shared";

type ProgressWriter = (event: AgentProgressEvent) => void;

interface ToolOutcome {
  text: string;
  count?: number;
  rows?: ToolResultRow[];
  truncated?: boolean;
}

function failureMessage(_error: unknown): string {
  return "Tool unavailable; continuing with fallback when possible.";
}

function site(url: string | undefined): { url: string } | Record<string, never> {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return {};
    return { url: parsed.toString() };
  } catch {
    return {};
  }
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function bounded(rows: ToolResultRow[]): { rows: ToolResultRow[]; truncated: boolean } {
  if (rows.length <= BOUNDED_RESULT_ROWS) return { rows, truncated: false };
  return { rows: rows.slice(0, BOUNDED_RESULT_ROWS), truncated: true };
}

const PLACE_KINDS: Array<[ToolResultKind, RegExp]> = [
  ["museum", /\b(museums?|galler(y|ies)|exhibitions?)\b/],
  ["cafe", /\b(cafes?|coffee|bakery|bakeries|tea ?house|tea ?room|dessert)\b/],
  [
    "restaurant",
    /\b(restaurants?|food|dining|diner|eatery|bistro|brasserie|meal|izakaya|ramen|sushi|takeaway)\b/,
  ],
  [
    "nightlife",
    /\b(bars?|pubs?|night ?clubs?|nightlife|lounge|brewery|winery|cocktails?|karaoke)\b/,
  ],
  ["shopping", /\b(shop|shops|shopping|mall|malls|market|markets|stores?|boutiques?|department)\b/],
  [
    "nature",
    /\b(parks?|gardens?|beach(es)?|nature|natural|hik(e|ing)|trails?|mountains?|lakes?|forests?|zoo|aquarium|campground|national park)\b/,
  ],
  ["stay", /\b(hotels?|lodging|hostels?|stays?|resorts?|accommodation)\b/],
  [
    "attraction",
    /\b(sights?|sightseeing|attractions?|landmarks?|tourist|monuments?|temples?|shrines?|castles?|palaces?|churches|church|cathedral|historic(al)?|viewpoints?|point of interest|amusement)\b/,
  ],
];

export function placeKind(category: string | undefined): ToolResultKind {
  const normalized = (category ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  return PLACE_KINDS.find(([, pattern]) => pattern.test(normalized))?.[0] ?? "place";
}

export function travelKind(mode: string): ToolResultKind {
  switch (mode) {
    case "drive":
    case "car":
    case "taxi":
      return "drive";
    case "transit":
    case "bus":
    case "train":
    case "tram":
    case "ferry":
    case "subway":
    case "metro":
      return "transit";
    case "walk":
      return "walk";
    case "flight":
      return "flight";
    default:
      return "route";
  }
}

const outOfFive = (rating: number) => `${(rating / 2).toFixed(1)}/5`;

function stayDetail(option: StayOption, currency: Currency): string {
  return [
    option.area,
    `${formatMoney(option.pricePerNight, currency)}/night`,
    outOfFive(option.rating),
    option.freeCancellation ? "Free cancellation" : "No free cancellation",
  ].join(" · ");
}

function flightDetail(option: FlightOption, currency: Currency): string {
  return [
    `${formatMoney(option.price, currency)}`,
    option.stops === undefined
      ? undefined
      : option.stops === 0
        ? "Nonstop"
        : plural(option.stops, "stop"),
    option.durationMin === undefined
      ? undefined
      : `${Math.round(option.durationMin / 60)}h ${option.durationMin % 60}m`,
    option.note,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function placeDetail(place: Place): string | undefined {
  const parts = [
    place.category,
    place.rating === undefined ? undefined : `${place.rating.toFixed(1)}/5`,
  ];
  const joined = parts.filter((part): part is string => Boolean(part)).join(" · ");
  return joined || undefined;
}

function optionDetail(option: RouteOption, currency: Currency): string {
  const hours = Math.floor(option.durationMin / 60);
  const minutes = option.durationMin % 60;
  const cost =
    option.priceBasis === "unavailable"
      ? "fare not published"
      : option.priceBasis === "partial"
        ? `from ${formatMoney(option.price, currency)}`
        : `${formatMoney(option.price, currency)}`;
  return [`${hours ? `${hours}h ` : ""}${minutes}m`, cost, option.note].filter(Boolean).join(" · ");
}

function routeDetail(leg: RouteLeg, currency: Currency): string {
  const hours = Math.floor(leg.durationMin / 60);
  const minutes = leg.durationMin % 60;
  return [
    leg.mode,
    `${hours ? `${hours}h ` : ""}${minutes}m`,
    `${formatMoney(leg.price, currency)}`,
    leg.note,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function withProgressTools(
  tools: ToolGateway,
  agent: AgentName,
  round: number,
  onProgress?: ProgressWriter,

  currency: Currency = "AUD",
): ToolGateway {
  let sequence = 0;

  async function run<T>(
    toolName: string,
    label: string,
    summary: string,
    args: Record<string, string>,
    operation: () => Promise<T>,
    resultSummary: (result: T) => ToolOutcome,
  ): Promise<T> {
    const callId = `${agent}:${round}:${++sequence}`;
    onProgress?.({
      type: "tool_started",
      agent,
      round,
      callId,
      tool: toolName,
      label,
      summary,
      args,
    });
    try {
      const result = await operation();
      const output = resultSummary(result);
      onProgress?.({
        type: "tool_completed",
        agent,
        round,
        callId,
        tool: toolName,
        label,
        resultSummary: output.text,
        ...(output.count === undefined ? {} : { resultCount: output.count }),
        ...(output.rows?.length ? { resultRows: output.rows } : {}),
        ...(output.truncated ? { resultTruncated: true } : {}),
      });
      return result;
    } catch (error) {
      onProgress?.({
        type: "tool_failed",
        agent,
        round,
        callId,
        tool: toolName,
        label,
        error: failureMessage(error),
      });
      throw error;
    }
  }

  const maps: MapsPort = {
    ...tools.maps,
    places: (query: Parameters<MapsPort["places"]>[0]) =>
      run(
        "maps.places",
        "Search places",
        `${query.category ?? "places"} near ${query.near}`,
        {
          near: query.near,
          ...(query.category ? { category: query.category } : {}),
        },
        () => tools.maps.places(query),
        (result) => {
          const { rows, truncated } = bounded(
            result.map((place) => ({
              label: place.name,
              detail: placeDetail(place),
              kind: placeKind(place.category || query.category),

              ...site(place.website),
            })),
          );
          return {
            text: plural(result.length, "place result"),
            count: result.length,
            rows,
            truncated,
          };
        },
      ),
    route: (query: RouteQuery) =>
      run(
        "maps.route",
        "Check route",
        `${query.from} → ${query.to}`,
        { from: query.from, to: query.to, ...(query.date ? { date: query.date } : {}) },
        () => tools.maps.route(query),
        (result) => {
          const { rows, truncated } = bounded(
            result.map((leg) => ({
              label: leg.mode,
              detail: routeDetail(leg, currency),
              kind: travelKind(leg.mode),
            })),
          );
          return {
            text: plural(result.length, "route option"),
            count: result.length,
            rows,
            truncated,
          };
        },
      ),
    ...(tools.maps.routeOptions
      ? {
          routeOptions: (query: RouteQuery) =>
            run(
              "maps.routeOptions",
              "Compare ways to travel",
              `${query.from} → ${query.to}`,
              { from: query.from, to: query.to, ...(query.date ? { date: query.date } : {}) },
              () => tools.maps.routeOptions!(query),
              (result) => {
                const { rows, truncated } = bounded(
                  result.map((option) => ({
                    label: option.mode,
                    detail: optionDetail(option, currency),
                    kind: travelKind(option.mode),
                  })),
                );
                return {
                  text: plural(result.length, "way to travel"),
                  count: result.length,
                  rows,
                  truncated,
                };
              },
            ),
        }
      : {}),
  };

  const booking: BookingPort = {
    ...tools.booking,
    searchStays: (query: StayQuery) =>
      run(
        "booking.searchStays",
        "Search stays",
        `${query.city} · ${query.checkIn}–${query.checkOut}`,
        {
          city: query.city,
          checkIn: query.checkIn,
          checkOut: query.checkOut,
          guests: String(query.guests),
        },
        () => tools.booking.searchStays(query),
        (result) => {
          const { rows, truncated } = bounded(
            result.map((option) => ({
              label: option.name,
              detail: stayDetail(option, currency),
              kind: "stay" as const,

              ...site(option.detailsUrl),
            })),
          );
          return {
            text: plural(result.length, "stay option"),
            count: result.length,
            rows,
            truncated,
          };
        },
      ),
    searchFlights: (query: FlightQuery) =>
      run(
        "booking.searchFlights",
        "Search flights",
        `${query.from} → ${query.to}`,
        {
          from: query.from,
          to: query.to,
          depart: query.depart,
          ...(query.return ? { return: query.return } : {}),
          passengers: String(query.passengers),
        },
        () => tools.booking.searchFlights(query),
        (result) => {
          const { rows, truncated } = bounded(
            result.map((option) => ({
              label: option.carrier,
              detail: flightDetail(option, currency),
              kind: "flight" as const,
            })),
          );
          return {
            text: plural(result.length, "flight option"),
            count: result.length,
            rows,
            truncated,
          };
        },
      ),
  };

  const weather: WeatherPort | undefined = tools.weather
    ? {
        forecast: (query: WeatherQuery) =>
          run(
            "weather.forecast",
            "Check weather",
            `Planning context for ${query.targetDate}`,
            { targetDate: query.targetDate },
            () => tools.weather!.forecast(query),
            (result) => ({
              text: `${result.provider} · ${result.horizon}`,
              rows: [
                {
                  label: result.summary,
                  detail: `${result.horizon} · ${result.provider}`,
                  kind: "weather",
                },
              ],
            }),
          ),
      }
    : undefined;

  return { maps, booking, weather };
}
