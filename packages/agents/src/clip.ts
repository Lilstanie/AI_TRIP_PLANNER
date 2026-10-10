export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentence >= max / 2) return cut.slice(0, sentence + 1);
  const word = cut.slice(0, max - 1).lastIndexOf(" ");
  return `${cut.slice(0, word > 0 ? word : max - 1)}…`;
}
