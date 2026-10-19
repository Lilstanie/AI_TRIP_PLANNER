const fields = new Set(["stayType", "minRating", "freeCancellation"]);

function parseCurrent(value) {
  if (value === undefined || value === null || value === "") return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new TypeError("Accommodation memory must be an object.");
    return parsed;
  } catch (error) {
    if (error instanceof TypeError) throw error;
    const type = /^(hotel|hostel|apartment|guesthouse)s?$/iu.exec(value)?.[1];
    if (type) return { stayType: type.toLowerCase() };
    const rating = /^(?:minimum|min)\s+rating\s*:?\s*(10(?:\.0)?|\d(?:\.\d)?)$/iu.exec(value)?.[1];
    if (rating) return { minRating: Number(rating) };
    if (/^free cancellation$/iu.test(value)) return { freeCancellation: true };
    return {};
  }
}

export function mergeAccommodationMemory(currentValue, patchValue) {
  const patch = JSON.parse(patchValue);
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    throw new TypeError("Accommodation memory patch must be an object.");
  for (const [key, value] of Object.entries(patch)) {
    if (!fields.has(key)) throw new TypeError(`Unsupported accommodation memory field: ${key}`);
    if (key === "stayType" && typeof value !== "string")
      throw new TypeError("Accommodation stayType must be a string.");
    if (
      key === "minRating" &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10)
    )
      throw new TypeError("Accommodation minRating must be between 0 and 10.");
    if (key === "freeCancellation" && typeof value !== "boolean")
      throw new TypeError("Accommodation freeCancellation must be a boolean.");
  }
  return JSON.stringify({ ...parseCurrent(currentValue), ...patch });
}
