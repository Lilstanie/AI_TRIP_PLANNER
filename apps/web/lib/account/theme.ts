export const THEMES = [
  "default",
  "island",
  "sunset",
  "forest",
  "city-night",
  "oled",
  "contrast",
] as const;
export type Theme = (typeof THEMES)[number];

export const ACCENTS = ["theme", "blue", "green", "orange", "purple", "pink"] as const;
export type Accent = (typeof ACCENTS)[number];

export type Appearance = "system" | "light" | "dark";

export const DARK_ONLY_THEMES: readonly Theme[] = ["city-night", "oled"];

export type ThemeChoice = { appearance: Appearance; theme?: Theme; accent?: Accent };

/** Returns the colour scheme the page renders in; dark-only themes ignore the Light appearance. */
export function resolveScheme(choice: ThemeChoice, systemDark: boolean): "light" | "dark" {
  if (choice.theme && DARK_ONLY_THEMES.includes(choice.theme)) return "dark";
  if (choice.appearance === "system") return systemDark ? "dark" : "light";
  return choice.appearance;
}

/**
 * Writes the theme attributes on `<html>`: `data-theme` (only when the scheme is forced),
 * `data-scheme` (always the resolved scheme), `data-palette` and `data-accent`
 * (absent for the defaults). `tokens.css` and `themes.css` read these attributes.
 */
export function applyTheme(root: HTMLElement, choice: ThemeChoice, systemDark: boolean) {
  const scheme = resolveScheme(choice, systemDark);
  const forced = choice.appearance !== "system" || scheme !== (systemDark ? "dark" : "light");
  if (forced) root.dataset.theme = scheme;
  else delete root.dataset.theme;
  root.dataset.scheme = scheme;
  if (choice.theme && choice.theme !== "default") root.dataset.palette = choice.theme;
  else delete root.dataset.palette;
  if (choice.accent && choice.accent !== "theme") root.dataset.accent = choice.accent;
  else delete root.dataset.accent;
}

/** Inline `<head>` script that applies the saved theme before first paint, mirroring `applyTheme`. */
export function savedThemeScript(settingsKey: string) {
  return `try {
var s = JSON.parse(localStorage.getItem(${JSON.stringify(settingsKey)}) ?? "null") || {};
var r = document.documentElement;
var systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
var theme = ${JSON.stringify(THEMES)}.indexOf(s.theme) > 0 ? s.theme : undefined;
var accent = ${JSON.stringify(ACCENTS)}.indexOf(s.accent) > 0 ? s.accent : undefined;
var appearance = s.appearance === "light" || s.appearance === "dark" ? s.appearance : "system";
var scheme = ${JSON.stringify(DARK_ONLY_THEMES)}.indexOf(theme) >= 0 ? "dark" : appearance === "system" ? (systemDark ? "dark" : "light") : appearance;
if (appearance !== "system" || scheme !== (systemDark ? "dark" : "light")) r.dataset.theme = scheme;
r.dataset.scheme = scheme;
if (theme) r.dataset.palette = theme;
if (accent) r.dataset.accent = accent;
} catch {}`;
}
