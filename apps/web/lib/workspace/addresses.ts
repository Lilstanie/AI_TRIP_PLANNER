import type { TripAddress } from "@trip/shared";
export const emptyAddress = (): TripAddress => ({ suburb: "", city: "", state: "", country: "" });
/** City first keeps city-based searches readable; no missing address part is guessed. */
export const addressText = (address: TripAddress) =>
  [address.city, address.suburb, address.state, address.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
export function legacyAddress(text: string): TripAddress {
  return { ...emptyAddress(), city: text.trim() };
}
