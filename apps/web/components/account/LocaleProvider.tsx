"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  formatAudForDisplay,
  resolveDisplayCurrency,
  translate,
  type CurrencyCode,
} from "@/lib/i18n/locale";
import { useSettings } from "./SettingsProvider";

type LocaleState = {
  locale: "en" | "zh-CN";
  t(text: string): string;
  currency(destination?: string): CurrencyCode;
  money(amount: number, destination?: string): string;
};

const LocaleContext = createContext<LocaleState>({
  locale: "en",
  t: (text) => text,
  currency: () => "AUD",
  money: (amount) => formatAudForDisplay(amount, "AUD", "en"),
});

export function LocaleProvider({
  children,
  destination = "",
}: {
  children: ReactNode;
  destination?: string;
}) {
  const { settings } = useSettings();
  const value = useMemo<LocaleState>(() => {
    const currency = (destinationOverride = destination) =>
      resolveDisplayCurrency(settings.displayCurrency, destinationOverride);
    return {
      locale: settings.language,
      t: (text) => translate(settings.language, text),
      currency,
      money: (amount, destinationOverride = destination) =>
        formatAudForDisplay(amount, currency(destinationOverride), settings.language),
    };
  }, [destination, settings.displayCurrency, settings.language]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
