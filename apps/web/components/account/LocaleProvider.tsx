"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  browserLocale,
  formatAudForDisplay,
  intlLocale,
  translate,
  type AppLocale,
  type MessageKey,
} from "@/lib/i18n/locale";
import { useSettings } from "./SettingsProvider";

type LocaleState = {
  locale: AppLocale;
  t(text: MessageKey): string;
  money(amount: number): string;
};

const LocaleContext = createContext<LocaleState>({
  locale: "en",
  t: (text) => text,
  money: (amount) => formatAudForDisplay(amount, "AUD", "en"),
});

/**
 * The saved language, or the browser's when the traveller never chose one. The browser is read
 * after hydration, so the server render and the first client render are both English.
 */
export function useInterfaceLocale(): AppLocale {
  const { settings } = useSettings();
  const [browser, setBrowser] = useState<AppLocale>("en");
  useEffect(() => setBrowser(browserLocale(navigator.languages ?? [navigator.language])), []);
  return settings.language ?? browser;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useInterfaceLocale();
  useEffect(() => {
    document.documentElement.lang = intlLocale(locale);
  }, [locale]);
  const value = useMemo<LocaleState>(
    () => ({
      locale,
      t: (text) => translate(locale, text),
      money: (amount) => formatAudForDisplay(amount, "AUD", locale),
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
