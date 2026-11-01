export type WeatherSky = "storm" | "snow" | "rain" | "fog" | "cloud" | "partly" | "sun";

const SKY_WORDS: Array<[WeatherSky, RegExp]> = [
  ["storm", /thunder|storm|雷/i],
  ["snow", /snow|sleet|雪/i],
  ["rain", /rain|shower|drizzle|雨/i],
  ["fog", /fog|mist|haze|雾/i],
  ["partly", /partly|mostly clear|mostly sunny|少云|多云间晴/i],
  ["cloud", /cloud|overcast|阴|云/i],
  ["sun", /clear|sunny|warm|hot|晴|炎热/i],
];

export function weatherSky(text: string): WeatherSky {
  return SKY_WORDS.find(([, words]) => words.test(text))?.[0] ?? "partly";
}

function Sun({ x = 12, y = 12, r = 4.2 }: { x?: number; y?: number; r?: number }) {
  return (
    <g className="weather-icon__sun">
      <circle cx={x} cy={y} r={r} />
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI) / 4;
        return (
          <line
            key={index}
            x1={x + Math.cos(angle) * (r + 1.8)}
            y1={y + Math.sin(angle) * (r + 1.8)}
            x2={x + Math.cos(angle) * (r + 3.6)}
            y2={y + Math.sin(angle) * (r + 3.6)}
          />
        );
      })}
    </g>
  );
}

const CLOUD = "M7 18.5h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.2A4 4 0 0 0 7 18.5z";

export function WeatherIcon({ sky }: { sky: WeatherSky }) {
  return (
    <svg className="weather-icon" data-sky={sky} viewBox="0 0 24 24" aria-hidden="true">
      {sky === "sun" && <Sun />}
      {sky === "partly" && <Sun x={8} y={8} r={3.2} />}
      {sky !== "sun" && <path className="weather-icon__cloud" d={CLOUD} />}
      {(sky === "rain" || sky === "storm") &&
        [9, 12.5, 16].map((x, index) => (
          <line
            key={x}
            className="weather-icon__drop"
            style={{ animationDelay: `${index * 0.3}s` }}
            x1={x}
            y1={20}
            x2={x - 1}
            y2={22.5}
          />
        ))}
      {sky === "snow" &&
        [9, 12.5, 16].map((x, index) => (
          <circle
            key={x}
            className="weather-icon__flake"
            style={{ animationDelay: `${index * 0.5}s` }}
            cx={x}
            cy={21}
            r={0.9}
          />
        ))}
      {sky === "storm" && (
        <path className="weather-icon__bolt" d="M13 13.5l-2.5 4h2.2l-1.2 4 3.5-5h-2.3l1.3-3z" />
      )}
      {sky === "fog" &&
        [20, 22.5].map((y) => (
          <line key={y} className="weather-icon__mist" x1={6} y1={y} x2={18} y2={y} />
        ))}
    </svg>
  );
}

function dateLabels(start: string, day: number): string[] {
  const time = Date.parse(`${start}T00:00:00Z`) + (day - 1) * 86_400_000;
  if (!Number.isFinite(time)) return [];
  return ["en-AU", "zh-CN"].flatMap((locale) => {
    const label = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(time);
    return [label, label.replace(/,/g, "")];
  });
}

function entryStart(text: string, at: number): number {
  const before = text.slice(0, at);
  const stop = before.lastIndexOf(". ");
  return Math.max(stop < 0 ? 0 : stop + 2, before.lastIndexOf("。") + 1);
}

export function weatherForDay(text: string, start: string, day: number, days: number): string {
  const entries: Array<{ day: number; at: number }> = [];
  for (let current = 1; current <= days; current++)
    for (const label of new Set(dateLabels(start, current))) {
      for (let at = text.indexOf(label); at >= 0; at = text.indexOf(label, at + label.length))
        entries.push({ day: current, at: entryStart(text, at) });
    }
  if (!entries.length) return text;
  const starts = [...new Set(entries.map((entry) => entry.at))].sort((a, b) => a - b);
  const mine = new Set(entries.filter((entry) => entry.day === day).map((entry) => entry.at));
  return starts
    .flatMap((at, index) => (mine.has(at) ? [text.slice(at, starts[index + 1]).trim()] : []))
    .join(" ");
}

export function TripWeather({ text }: { text: string }) {
  return (
    <p className="timeline-day__weather">
      <WeatherIcon sky={weatherSky(text)} />
      <span>{text}</span>
    </p>
  );
}
