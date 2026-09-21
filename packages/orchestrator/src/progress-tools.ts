import type {
  AgentName,
  AgentProgressEvent,
  BookingPort,
  FlightQuery,
  MapsPort,
  RouteQuery,
  StayQuery,
  ToolGateway,
  WeatherPort,
  WeatherQuery,
} from "@trip/shared";

type ProgressWriter = (event: AgentProgressEvent) => void;

function failureMessage(_error: unknown): string {
  // Provider diagnostics stay server-side; the transcript only needs a safe lifecycle label.
  return "Tool unavailable; continuing with fallback when possible.";
}

/**
 * Add DeepSeek-style tool lifecycle events without changing the agent-facing gateway contract.
 * The summaries intentionally contain only safe, high-level query context — never credentials or
 * raw provider payloads.
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
    operation: () => Promise<T>,
    resultSummary: (result: T) => { text: string; count?: number },
  ): Promise<T> {
    const callId = `${agent}:${round}:${++sequence}`;
    onProgress?.({ type: "tool_started", agent, round, callId, tool: toolName, label, summary });
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
    places: (query: Parameters<MapsPort["places"]>[0]) =>
      run(
        "maps.places",
        "Search places",
        `${query.category ?? "places"} near ${query.near}`,
        () => tools.maps.places(query),
        (result) => ({ text: `${result.length} place result(s)`, count: result.length }),
      ),
    route: (query: RouteQuery) =>
      run(
        "maps.route",
        "Check route",
        `${query.from} → ${query.to}`,
        () => tools.maps.route(query),
        (result) => ({ text: `${result.length} route option(s)`, count: result.length }),
      ),
  };

  const booking: BookingPort = {
    searchStays: (query: StayQuery) =>
      run(
        "booking.searchStays",
        "Search stays",
        `${query.city} · ${query.checkIn}–${query.checkOut}`,
        () => tools.booking.searchStays(query),
        (result) => ({ text: `${result.length} stay option(s)`, count: result.length }),
      ),
    searchFlights: (query: FlightQuery) =>
      run(
        "booking.searchFlights",
        "Search flights",
        `${query.from} → ${query.to}`,
        () => tools.booking.searchFlights(query),
        (result) => ({ text: `${result.length} flight option(s)`, count: result.length }),
      ),
  };

  const weather: WeatherPort | undefined = tools.weather
    ? {
        forecast: (query: WeatherQuery) =>
          run(
            "weather.forecast",
            "Check weather",
            `Planning context for ${query.targetDate}`,
            () => tools.weather!.forecast(query),
            (result) => ({ text: `${result.provider} · ${result.horizon}` }),
          ),
      }
    : undefined;

  return { maps, booking, weather };
}
