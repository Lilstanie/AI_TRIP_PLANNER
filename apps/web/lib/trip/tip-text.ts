export const MAX_TIPS = 5;

const KEEP_GOING = new Set(
  "st mt dr mr mrs ms no vs etc approx est inc ltd co jan feb mar apr jun jul aug sep sept oct nov dec".split(
    " ",
  ),
);

function continues(before: string): boolean {
  const token = (before.match(/(\S+)$/)?.[1] ?? "").replace(/^[("'“‘[]+/, "");
  if (!token.endsWith(".") || token.endsWith("..")) return false;
  return /^(?:[A-Za-z]\.)+$/.test(token) || KEEP_GOING.has(token.slice(0, -1).toLowerCase());
}

export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = /[.!?]+(?=\s)|[。！？]+/g;
  for (let match = end.exec(trimmed); match; match = end.exec(trimmed)) {
    const stop = match.index + match[0].length;
    if (match[0] !== "." || !continues(trimmed.slice(0, stop))) return trimmed.slice(0, stop);
  }
  return trimmed;
}

const SCOPE_PREFIX = /^(?:Planning context for [^.]*?\. |以下仅为[^。]*。)(?=\S)/;

export function tipSentence(text: string): string {
  const rest = text.trim().replace(SCOPE_PREFIX, "");
  return firstSentence(rest || text);
}

export function packingLine(packing: string[] | undefined, separator: string): string {
  return (packing ?? []).join(separator);
}
