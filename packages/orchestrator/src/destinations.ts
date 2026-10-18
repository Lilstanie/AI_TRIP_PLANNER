const SEPARATORS = /\s*&\s*|\s*、\s*|\s+and\s+/giu;

/**
 * A destination string in the brief's own form: the cities to visit, in order, joined with ` & `.
 *
 * The rest of the system splits `TripBrief.destination` on `&` (`cities` in `@trip/agents`, the
 * Agent Lab registry, and the workspace's Where editor), but nothing told the extractors that, so a
 * traveller who wrote "Sydney and Wollongong" got one city with that whole phrase as its name.
 * Normalising at the two places a brief is produced keeps every reader unchanged.
 *
 * A place whose own name contains "and" (Trinidad and Tobago) is split into two stops. That is the
 * cost of reading an unstructured field; the model is asked to send the cities separately, which
 * avoids the guess entirely when a model is configured.
 */
export function normaliseDestination(value: string): string {
  const cities = value
    .split(SEPARATORS)
    .map((city) => city.trim())
    .filter(Boolean);
  return cities.length ? cities.join(" & ") : value.trim();
}
