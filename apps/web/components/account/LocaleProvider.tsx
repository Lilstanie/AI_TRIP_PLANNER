"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  browserLocale,
  intlLocale,
  translate,
  type AppLocale,
  type MessageKey,
} from "@/lib/i18n/locale";
import { moneyDisplay, type Money } from "@/lib/money";
import { noticeText, type Notice } from "@/lib/i18n/notice";
import { useSettings } from "./SettingsProvider";

import { effectiveCurrency, type Currency, type TripBrief } from "@trip/shared";

/** Language, display currency and the Money formatters for both. */
type LocaleState = Money & {
  locale: AppLocale;
  t(text: MessageKey, params?: Record<string, string | number>): string;
  currency: Currency;
  /** A notice in the interface language; nothing to show is an empty string. */
  notice(notice: Notice | undefined): string;
};

const LocaleContext = createContext<LocaleState>({
  locale: "en",
  currency: "AUD",
  notice: (notice) => localNotice("en", notice),
  t: (text, params) => translate("en", text, params),
  ...moneyDisplay({ currency: "AUD", locale: "en" }),
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

export function LocaleProvider({
  children,
  brief,
}: {
  children: ReactNode;
  brief?: Pick<TripBrief, "budgetSource" | "displayCurrency">;
}) {
  const { settings } = useSettings();
  const currency = effectiveCurrency(brief, settings.displayCurrency);
  const locale = useInterfaceLocale();
  useEffect(() => {
    document.documentElement.lang = intlLocale(locale);
  }, [locale]);
  const value = useMemo<LocaleState>(
    () => ({
      locale,
      t: (text, params) => translate(locale, text, params),
      currency,
      notice: (notice) => localNotice(locale, notice),
      ...moneyDisplay({ currency, locale }),
    }),
    [locale, currency],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

const localNotice = (locale: AppLocale, notice: Notice | undefined) =>
  notice ? noticeText(locale, notice) : "";
