function profileCoversMemory(brief, preference) {
  const profile = [...(brief.preferences ?? []), ...(brief.learnedPreferences ?? [])]
    .join(" ")
    .toLocaleLowerCase();
  const key = preference.key;
  if (key === "dietary")
    return /dietary|allerg|vegan|vegetarian|halal|kosher|gluten|celiac|lactose|dairy[- ]free|nut[- ]free|shellfish|pescatarian|do not eat|don't eat|cannot eat|不吃|忌口|过敏|素食|纯素|清真|犹太洁食|无麸质|乳糖不耐/i.test(
      profile,
    );
  if (key === "pace") return /pace|relaxed|balanced|packed|early start|slow morning/i.test(profile);
  if (key === "interests")
    return /museum|(?:^|[^a-z])art(?:$|[^a-z])|history|culture|hiking|nature|beach|food tour|cuisine|restaurant|shopping|architecture|nightlife/i.test(
      profile,
    );
  if (key === "accessibility") return /accessib|step-free|wheelchair|low-walking/i.test(profile);
  if (key === "accommodation" || key.startsWith("accommodation."))
    return (
      Boolean(brief.accommodation) ||
      /accommodation|hotel|hostel|apartment|guesthouse|minimum rating|free cancellation/i.test(
        profile,
      )
    );
  if (key === "departure_city" || key === "transport.origin") return Boolean(brief.origin?.trim());
  return false;
}

export function memoriesForBrief(brief, memories) {
  const uncovered = memories.filter((preference) => !profileCoversMemory(brief, preference));
  return brief.accommodation
    ? [
        ...uncovered.filter((preference) => !preference.key.startsWith("accommodation.")),
        ...Object.entries(brief.accommodation).map(([key, value]) => ({
          key: `accommodation.${key}`,
          value: String(value),
          source: "filter",
        })),
      ]
    : uncovered;
}
