import { keyForStoredText, translate, type AppLocale } from "../i18n/locale";

export function memoryDisplay(value: string, locale: AppLocale): string {
  try {
    const preference = JSON.parse(value) as Record<string, unknown>;
    if (typeof preference !== "object" || preference === null) return value;
    return (
      [
        typeof preference.stayType === "string" ? memoryDisplay(preference.stayType, locale) : "",
        typeof preference.minRating === "number"
          ? translate(locale, "minimumRatingV0", { v0: preference.minRating })
          : "",
        preference.freeCancellation === true ? translate(locale, "freeCancellationTitle") : "",
      ]
        .filter(Boolean)
        .join(" · ") || value
    );
  } catch {
    const rating = /^minimum rating: (\d(?:\.\d)?)$/i.exec(value);
    if (rating) return translate(locale, "minimumRatingV0", { v0: rating[1]! });
    const key = keyForStoredText(value);
    return key ? translate(locale, key) : value;
  }
}
