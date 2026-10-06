"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  browserLocale,
  formatAudForDisplay,
  intlLocale,
  interfaceNotice,
  translate,
  type AppLocale,
  type MessageKey,
} from "@/lib/i18n/locale";
import { noticeText, type Notice } from "@/lib/i18n/notice";
import { useSettings } from "./SettingsProvider";

import type { Currency, TripBrief } from "@trip/shared";

type LocaleState = {
  locale: AppLocale;
  t(text: MessageKey, params?: Record<string, string | number>): string;
  currency: Currency;
  /**
   * A notice in the interface language. A string is English the app has not yet converted to a
   * keyed `Notice`, matched against the dictionary and the remaining notice patterns.
   */
  notice(notice: Notice | string | undefined): string;
  money(amount: number, source?: TripBrief["budgetSource"]): string;
};

const LocaleContext = createContext<LocaleState>({
  locale: "en",
  currency: "AUD",
  notice: (notice) => localNotice("en", notice),
  t: (text, params) => translate("en", text, params),
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

export function LocaleProvider({
  children,
  brief,
}: {
  children: ReactNode;
  brief?: Pick<TripBrief, "budgetSource">;
}) {
  const { settings } = useSettings();
  const currency = brief?.budgetSource?.currency ?? settings.displayCurrency;
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
      money: (amount, source) =>
        formatAudForDisplay(amount, currency, locale, undefined, undefined, source),
    }),
    [locale, currency],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

const localNotice = (locale: AppLocale, notice: Notice | string | undefined) =>
  typeof notice === "object" ? noticeText(locale, notice) : interfaceNotice(locale, notice ?? "");
