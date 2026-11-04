"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import {
  browserLocale,
  intlLocale,
  MESSAGES,
  translate,
  fillMessage,
  type AppLocale,
  type MessageKey,
  type MessageParams,
} from "@/lib/i18n/locale";
import { moneyDisplay, type Money } from "@/lib/money";
import { noticeText, type Notice } from "@/lib/i18n/notice";
import { useSettings } from "./SettingsProvider";

import { effectiveCurrency, type Currency, type TripBrief } from "@trip/shared";

type LocaleState = Money & {
  locale: AppLocale;
  t(text: MessageKey, params?: MessageParams): string;
  currency: Currency;

  notice(notice: Notice | undefined): string;
};

const LocaleContext = createContext<LocaleState>({
  locale: "en",
  currency: "AUD",
  notice: (notice) => localNotice("en", notice),
  t: (text, params) => translate("en", text, params),
  ...moneyDisplay({ currency: "AUD", locale: "en" }),
});

export function useInterfaceLocale(): AppLocale {
  const { settings } = useSettings();
  const browser = useSyncExternalStore(subscribeLanguages, navigatorLocale, () => "en" as const);
  return settings.language ?? browser;
}

function subscribeLanguages(onChange: () => void) {
  window.addEventListener("languagechange", onChange);
  return () => window.removeEventListener("languagechange", onChange);
}

function navigatorLocale(): AppLocale {
  return browserLocale(navigator.languages ?? [navigator.language]);
}

export function LocaleProvider({
  children,
  brief,
}: {
  children: ReactNode;
  brief?: Pick<TripBrief, "budgetSource" | "displayCurrency">;
}) {
  const locale = useInterfaceLocale();
  useEffect(() => {
    document.documentElement.lang = intlLocale(locale);
  }, [locale]);
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <LocaleValue locale={locale} brief={brief}>
        {children}
      </LocaleValue>
    </NextIntlClientProvider>
  );
}

function LocaleValue({
  children,
  locale,
  brief,
}: {
  children: ReactNode;
  locale: AppLocale;
  brief?: Pick<TripBrief, "budgetSource" | "displayCurrency">;
}) {
  const { settings } = useSettings();
  const currency = effectiveCurrency(brief, settings.displayCurrency);
  const translations = useTranslations();
  const value = useMemo<LocaleState>(
    () => ({
      locale,
      t: (text, params = {}) =>
        fillMessage(
          locale,
          translations as (key: string, values: MessageParams) => string,
          text,
          params,
        ),
      currency,
      notice: (notice) => localNotice(locale, notice),
      ...moneyDisplay({ currency, locale }),
    }),
    [locale, currency, translations],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

const localNotice = (locale: AppLocale, notice: Notice | undefined) =>
  notice ? noticeText(locale, notice) : "";
