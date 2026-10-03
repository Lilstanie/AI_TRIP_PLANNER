"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formatAudForDisplay, translate } from "@/lib/i18n/locale";
import { useSettings } from "./SettingsProvider";

type LocaleState = {
  locale: "en" | "zh-CN";
  t(text: string): string;
  money(amount: number): string;
};

const LocaleContext = createContext<LocaleState>({
  locale: "en",
  t: (text) => text,
  money: (amount) => formatAudForDisplay(amount, "AUD", "en"),
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const value = useMemo<LocaleState>(() => {
    return {
      locale: settings.language,
      t: (text) => translate(settings.language, text),
      money: (amount) => formatAudForDisplay(amount, "AUD", settings.language),
    };
  }, [settings.language]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
