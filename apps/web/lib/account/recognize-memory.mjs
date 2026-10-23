const categories = [
  {
    key: "dietary",
    pattern:
      /\b(?:i\s+don['’]?t\s+eat\s+spicy\s+food|i\s+can\s+eat\s+spicy\s+food\s+now)\b|我(?:现在)?(?:不吃辣|可以吃辣了)/iu,
    value: (match) =>
      /can eat|可以吃辣/iu.test(match) ? "Can eat spicy food" : "Does not eat spicy food",
  },
  {
    key: "pace",
    pattern:
      /\b(?:i\s+prefer|i\s+like|we\s+prefer|we\s+like)\s+(?:a\s+)?(relaxed|balanced|packed)\s+pace\b/iu,
    value: (_match, capture) => `${capture.toLowerCase()} pace`,
  },
  {
    key: "interests",
    pattern:
      /\b(?:i\s+(?:love|enjoy)|we\s+(?:love|enjoy))\s+(museums?|art|history|culture|hiking|nature|beaches|food)\b/iu,
    value: (_match, capture) =>
      capture
        .toLowerCase()
        .replace(/museums$/i, "museum")
        .replace(/beaches$/i, "beach"),
  },
  {
    key: "accessibility",
    pattern:
      /\b(?:i\s+need|we\s+need|i\s+require|we\s+require)\s+(step-free access|wheelchair access|low-walking routes)\b/iu,
    value: (_match, capture) => capture.toLowerCase(),
  },
  {
    key: "accommodation",
    pattern:
      /\b(?:i\s+prefer|we\s+prefer)\s+(hotels?|hostels?|apartments?|guesthouses?)\b|\b(?:i\s+need|we\s+need|i\s+require|we\s+require)\s+(?:a\s+)?rating\s+of\s+at\s+least\s+(10(?:\.0)?|\d(?:\.\d)?)\b|\b(?:i\s+need|we\s+need|i\s+require|we\s+require)\s+free\s+cancellation\b/iu,
    value: (match) => {
      const type = /\b(hotels?|hostels?|apartments?|guesthouses?)\b/iu.exec(match)?.[1];
      if (type) return JSON.stringify({ stayType: type.toLowerCase().replace(/s$/, "") });
      const rating = /rating\s+of\s+at\s+least\s+(10(?:\.0)?|\d(?:\.\d)?)/iu.exec(match)?.[1];
      return rating
        ? JSON.stringify({ minRating: Number(rating) })
        : JSON.stringify({ freeCancellation: true });
    },
  },
  {
    key: "departure_city",
    pattern: /\b(?:my|our)\s+usual\s+departure\s+city\s+is\s+([A-Z][\p{L}' -]{1,48})\s*[.!?]?$/iu,
    value: (_match, capture) => capture.trim(),
  },
];

export function recognizeAccountMemory(message) {
  if (/\b(?:for|on)\s+this\s+trip\b|这次旅行|本次行程/iu.test(message)) return undefined;
  for (const category of categories) {
    const match = category.pattern.exec(message);
    if (match) return { key: category.key, value: category.value(match[0], match[1] ?? "") };
  }
  return undefined;
}
