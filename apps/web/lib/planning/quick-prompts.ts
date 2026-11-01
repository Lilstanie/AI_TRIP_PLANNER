import type { AppLocale } from "@/lib/i18n/locale";
import { enExamples } from "@/lib/i18n/messages/en-examples";
import { zhExamples } from "@/lib/i18n/messages/zh-examples";
import { toIsoDate } from "./date-range";

export type ExampleKey = keyof typeof enExamples;

const EXAMPLE_MESSAGES: Record<AppLocale, Record<ExampleKey, string>> = {
  en: enExamples,
  zh: zhExamples,
};

export function exampleText(
  locale: AppLocale,
  key: ExampleKey,
  params: Record<string, string> = {},
): string {
  return EXAMPLE_MESSAGES[locale][key].replace(
    /\{(\w+)\}/g,
    (slot, name: string) => params[name] ?? slot,
  );
}

export type QuickPromptShape = "city" | "route" | "multi";

export type QuickPrompt = {
  label: ExampleKey;
  text: ExampleKey;
  shape: QuickPromptShape;
  params: { start: string; end: string };
};

type Example = { name: string; shape: QuickPromptShape; startIn: number; days: number };

const EXAMPLES: readonly Example[] = [
  { name: "Sydney", shape: "city", startIn: 21, days: 4 },
  { name: "TokyoFamily", shape: "city", startIn: 35, days: 6 },
  { name: "KyotoSolo", shape: "city", startIn: 28, days: 4 },
  { name: "ParisHoneymoon", shape: "city", startIn: 60, days: 7 },
  { name: "BangkokFood", shape: "city", startIn: 24, days: 5 },
  { name: "QueenstownSki", shape: "city", startIn: 45, days: 5 },
  { name: "BaliBackpacking", shape: "city", startIn: 30, days: 6 },
  { name: "NewYorkFriends", shape: "city", startIn: 50, days: 5 },
  { name: "ReykjavikAurora", shape: "city", startIn: 70, days: 5 },
  { name: "MelbourneSydney", shape: "route", startIn: 30, days: 5 },
  { name: "MelbourneOsaka", shape: "route", startIn: 40, days: 6 },
  { name: "SydneySingapore", shape: "route", startIn: 33, days: 5 },
  { name: "PerthBali", shape: "route", startIn: 26, days: 7 },
  { name: "BrisbaneVancouver", shape: "route", startIn: 55, days: 8 },
  { name: "SydneyWollongong", shape: "multi", startIn: 60, days: 5 },
  { name: "TokyoKyoto", shape: "multi", startIn: 42, days: 8 },
  { name: "RomeVenice", shape: "multi", startIn: 65, days: 8 },
  { name: "HanoiSaigon", shape: "multi", startIn: 38, days: 9 },
  { name: "LondonEdinburgh", shape: "multi", startIn: 48, days: 7 },
];

/** Every example trip, dated relative to `today`, in catalogue order. */
export function allQuickPrompts(today: Date = new Date()): QuickPrompt[] {
  const inDays = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return toIsoDate(date);
  };
  return EXAMPLES.map(({ name, shape, startIn, days }) => ({
    label: `example${name}` as ExampleKey,
    text: `example${name}Prompt` as ExampleKey,
    shape,
    params: { start: inDays(startIn), end: inDays(startIn + days - 1) },
  }));
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * A fresh random draw of `count` example trips that always includes one single-city trip, one
 * trip with a stated origin and one multi-city trip, in random order. Call it only on the client:
 * a server render would draw a different set and break hydration.
 */
export function quickPrompts(
  today: Date = new Date(),
  random: () => number = Math.random,
  count = 4,
): QuickPrompt[] {
  const pool = shuffled(allQuickPrompts(today), random);
  const picked = (["city", "route", "multi"] as const).map((shape) =>
    pool.find((prompt) => prompt.shape === shape)!,
  );
  for (const prompt of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(prompt)) picked.push(prompt);
  }
  return shuffled(picked.slice(0, count), random);
}
