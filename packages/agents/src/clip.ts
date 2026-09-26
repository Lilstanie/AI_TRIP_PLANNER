/**
 * Shorten model prose to `max` characters, at a sentence end when one is close
 * enough, otherwise at a word with an ellipsis.
 *
 * Models cannot count characters. A structured-output schema that rejects a
 * 414-character summary against a 400 limit throws the whole draft away, and
 * the retry can loop until LangGraph's recursion limit, so specialists ask for
 * unbounded prose and clip it here before their strict schema.
 */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentence >= max / 2) return cut.slice(0, sentence + 1);
  const word = cut.slice(0, max - 1).lastIndexOf(" ");
  return `${cut.slice(0, word > 0 ? word : max - 1)}…`;
}
