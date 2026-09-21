"use client";
import { BASE_CURRENCY, moneyIn, type FlightAnswer } from "@trip/shared";

function duration(minutes: number | undefined): string | undefined {
  if (!minutes) return undefined;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

function stops(count: number | undefined): string | undefined {
  if (count === undefined) return undefined;
  return count === 0 ? "Nonstop" : count === 1 ? "1 stop" : `${count} stops`;
}

/**
 * Fares for a flight question, shown instead of a trip plan.
 *
 * Cheapest first, because that is what the question almost always means, and
 * the whole-party framing is stated rather than assumed — a per-person reading
 * of these numbers would be wrong by the size of the group.
 */
export function FlightResults({ answer }: { answer: FlightAnswer }) {
  const party =
    answer.passengers === 1 ? "1 traveller" : `${answer.passengers} travellers`;
  return (
    <section className="flight-results" aria-label={`Fares from ${answer.from} to ${answer.to}`}>
      <header className="flight-results__head">
        <strong>
          {answer.from} → {answer.to}
        </strong>
        <span className="flight-results__meta">
          {answer.depart}
          {answer.return ? ` – ${answer.return}` : ""} · {party}
        </span>
      </header>
      {answer.options.length ? (
        <ol className="flight-results__list">
          {answer.options.slice(0, 6).map((option, index) => {
            const detail = [stops(option.stops), duration(option.durationMin)]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={`${option.carrier}-${index}`} className="flight-results__row">
                <span className="flight-results__carrier">{option.carrier}</span>
                {detail && <span className="flight-results__detail">{detail}</span>}
                <span className="flight-results__price">
                  {moneyIn(option.price, BASE_CURRENCY)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="muted">No fares were returned for this search.</p>
      )}
      <p className="flight-results__note">
        Whole-party totals. {answer.source?.freshness ?? "Prices change without notice."} Nothing
        here makes a booking.
      </p>
    </section>
  );
}
