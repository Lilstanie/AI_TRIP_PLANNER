import {
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

/** What one tool call publishes back to the transcript. */
interface ToolOutcome {
  text: string;
  count?: number;
  rows?: ToolResultRow[];
  truncated?: boolean;
}

function failureMessage(_error: unknown): string {
  // Provider diagnostics stay server-side; the transcript only needs a safe lifecycle label.
  return "Tool unavailable; continuing with fallback when possible.";
}

/**
 * The web page a result row refers to, when the provider gave one. Clients show
 * the site's icon for it, so anything that is not an http(s) page — a `tel:`
 * link, a provider's own placeholder — is dropped rather than published as a
 * site this result does not have.
 */
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

/** `20 options` reads false for one result; keep the plural honest. */
function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Bound a result list to the rows a transcript can carry. The count is kept
 * separate from the rows so a reader still sees the true size of the result
 * when only the head is published.
 */
function bounded(rows: ToolResultRow[]): { rows: ToolResultRow[]; truncated: boolean } {
  if (rows.length <= BOUNDED_RESULT_ROWS) return { rows, truncated: false };
  return { rows: rows.slice(0, BOUNDED_RESULT_ROWS), truncated: true };
}

/**
 * Place categories come from agents ("sight", "restaurant") and from providers
 * (Google's "tourist_attraction", "night_club", OSM's "viewpoint"), so they are
 * matched by keyword rather than by a closed list. Order matters: "art gallery
 * cafe" is a museum, and a "coffee shop" is a cafe before it is shopping.
 */
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

/** The icon kind for a place, defaulting to a generic place. */
export function placeKind(category: string | undefined): ToolResultKind {
  // Accents are stripped first: `\b` treats "é" as a non-word character.
  const normalized = (category ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  return PLACE_KINDS.find(([, pattern]) => pattern.test(normalized))?.[0] ?? "place";
}

/** The icon kind for a journey leg or option, by its TravelMode (or a provider synonym). */
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

/** `AUD 210.00 · 8.9/10 · free cancellation`. */
function stayDetail(option: StayOption): string {
  return [
    option.area,
    `AUD ${option.pricePerNight.toFixed(2)}/night`,
    `${option.rating.toFixed(1)}/10`,
    option.freeCancellation ? "Free cancellation" : "No free cancellation",
  ].join(" · ");
}

function flightDetail(option: FlightOption): string {
  return [
    `AUD ${option.price.toFixed(2)}`,
    option.stops === undefined ? undefined : option.stops === 0 ? "Nonstop" : plural(option.stops, "stop"),
    option.durationMin === undefined
      ? undefined
      : `${Math.round(option.durationMin / 60)}h ${option.durationMin % 60}m`,
    option.note,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function placeDetail(place: Place): string | undefined {
  const parts = [place.category, place.rating === undefined ? undefined : `${place.rating}/10`];
  const joined = parts.filter((part): part is string => Boolean(part)).join(" · ");
  return joined || undefined;
}

/** A travel option in one line, with the cost qualified by how much is known. */
function optionDetail(option: RouteOption): string {
  const hours = Math.floor(option.durationMin / 60);
  const minutes = option.durationMin % 60;
  const cost =
    option.priceBasis === "unavailable"
      ? "fare not published"
      : option.priceBasis === "partial"
        ? `from AUD ${option.price.toFixed(2)}`
        : `AUD ${option.price.toFixed(2)}`;
  return [`${hours ? `${hours}h ` : ""}${minutes}m`, cost, option.note].filter(Boolean).join(" · ");
}

function routeDetail(leg: RouteLeg): string {
  const hours = Math.floor(leg.durationMin / 60);
  const minutes = leg.durationMin % 60;
  return [
    leg.mode,
    `${hours ? `${hours}h ` : ""}${minutes}m`,
    `AUD ${leg.price.toFixed(2)}`,
    leg.note,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/**
 * Add DeepSeek-style tool lifecycle events without changing the agent-facing gateway contract.
 * The summaries intentionally contain only safe, high-level query context — never credentials or
 * raw provider payloads.
 *
 * The result rows are the result itself, restated for a reader: the stay candidates a search
 * returned, the places it found, the legs a route had. They are bounded by BOUNDED_RESULT_ROWS so
 * one wide search cannot make the progress stream unbounded.
 */
export function withProgressTools(
  tools: ToolGateway,
  agent: AgentName,
  round: number,
  onProgress?: ProgressWriter,
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
    // Spread first so a capability added to MapsPort keeps working here even if
    // nobody remembers to wrap it. Re-listing every method by hand silently
    // dropped routeOptions: the agent saw `undefined`, took its own "no
    // comparison available" branch, and the feature looked merely unused.
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
              // Only what the provider reported. A place with no site keeps
              // its category glyph rather than borrowing another site's icon.
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
              detail: routeDetail(leg),
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
                    detail: optionDetail(option),
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
    // Spread first, for the same reason as maps above: re-listing the port's
    // methods by hand silently drops anything added to it later.
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
              detail: stayDetail(option),
              kind: "stay" as const,
              // Whatever page the provider published for the property: its own
              // site from Google Places, the details page from SerpApi.
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
              detail: flightDetail(option),
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
