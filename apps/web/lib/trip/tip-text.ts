const ABBREVIATION = /(?:^|\s)(?:St|Mt|Dr|Mr|Mrs|Ms|No|vs|etc)\.$/;

export const MAX_TIPS = 5;

export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = /[.!?]+(?=\s)|[。！？]+/g;
  for (let match = end.exec(trimmed); match; match = end.exec(trimmed)) {
    const stop = match.index + match[0].length;
    if (!ABBREVIATION.test(trimmed.slice(0, stop))) return trimmed.slice(0, stop);
  }
  return trimmed;
}

export function packingLine(packing: string[] | undefined, separator: string): string {
  return (packing ?? []).join(separator);
}
